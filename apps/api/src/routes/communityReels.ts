import type { FastifyInstance } from "fastify";
import { ReelsFeedQuerySchema } from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import { getReelsSlice, refreshReelsCache } from "../lib/reelsCache.js";
import {
  getCommunityProfile,
  hydratePosts,
  mapPost,
  POST_SELECT,
} from "./communityHelpers.js";

export async function communityReelsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireActiveCommunityProfile);

  /**
   * GET /v1/community/reels?cursor=0&limit=8
   * Snappy: pulls a slice from Redis sorted set, then SELECTs only those rows.
   * On a cold cache, falls back to direct Postgres query and triggers a
   * background refresh.
   */
  fastify.get("/", async (request, reply) => {
    const parsed = ReelsFeedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: parsed.error.message });
    }
    const { cursor, limit } = parsed.data;
    const viewerProfile = await getCommunityProfile(request.user.id);
    const viewerProfileId = (viewerProfile?.["id"] as string | undefined) ?? null;

    let { ids, cold } = await getReelsSlice(cursor, limit);

    if (cold) {
      // Trigger refresh asynchronously, then fall back to direct query
      void refreshReelsCache().catch(() => undefined);
      const { data: rows } = await supabase
        .from("community_posts")
        .select(POST_SELECT)
        .eq("post_type", "video")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(cursor, cursor + limit - 1);
      ids = (rows ?? []).map((r: any) => r["id"] as string);
    }

    if (!ids.length) {
      return reply.send({ posts: [], nextCursor: null, hasMore: false });
    }

    // Filter dismissed
    if (viewerProfileId) {
      const { data: dismissed } = await supabase
        .from("community_post_dismissals")
        .select("post_id")
        .eq("community_profile_id", viewerProfileId)
        .in("post_id", ids);
      if (dismissed?.length) {
        const dismissedSet = new Set(dismissed.map((d) => d["post_id"] as string));
        ids = ids.filter((id) => !dismissedSet.has(id));
      }
    }

    if (!ids.length) {
      return reply.send({ posts: [], nextCursor: cursor + limit, hasMore: true });
    }

    const { data: rows, error } = await supabase
      .from("community_posts")
      .select(POST_SELECT)
      .in("id", ids)
      .is("deleted_at", null);
    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to load reels" });
    }
    const rowsArr = (rows ?? []) as Array<Record<string, unknown>>;
    // Preserve ranking order from Redis
    const idIndex = new Map(ids.map((id, i) => [id, i] as const));
    rowsArr.sort((a, b) => (idIndex.get(a["id"] as string) ?? 0) - (idIndex.get(b["id"] as string) ?? 0));

    const ctx = await hydratePosts(rowsArr, viewerProfileId);
    const posts = rowsArr.map((row) => mapPost(row, { viewerProfile, ...ctx }));

    return reply.send({
      posts,
      nextCursor: cursor + ids.length,
      hasMore: rowsArr.length === limit,
    });
  });

  /** Manual refresh — admin/debug. */
  fastify.post("/_refresh", async (_req, reply) => {
    const count = await refreshReelsCache();
    return reply.send({ refreshed: count });
  });
}
