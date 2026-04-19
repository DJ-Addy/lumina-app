import type { FastifyInstance } from "fastify";
import {
  CreateCommunityPostRequestSchema,
  CommunityFeedQuerySchema,
  CreateCommentRequestSchema,
  AddReactionRequestSchema,
  ReportRequestSchema,
  UpdateCommunityProfileRequestSchema,
} from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import { queues } from "../lib/queue.js";

export async function communityRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/profile/me", async (request, reply) => {
    const { data, error } = await supabase
      .from("community_profiles")
      .select("*")
      .eq("user_id", request.user.id)
      .single();

    if (error || !data) {
      const alias = await generateThemedAlias();
      const { data: created, error: createError } = await supabase
        .from("community_profiles")
        .insert({
          user_id: request.user.id,
          alias,
          avatar_seed: Math.random().toString(36).slice(2, 10),
        })
        .select()
        .single();

      if (createError || !created) {
        return reply.status(500).send({ code: "DB_ERROR", message: "Failed to create profile" });
      }
      return reply.status(201).send({ profile: mapProfile(created) });
    }
    return reply.send({ profile: mapProfile(data) });
  });

  fastify.patch("/profile/me", async (request, reply) => {
    const body = UpdateCommunityProfileRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    if (body.data.alias) {
      const { count } = await supabase
        .from("community_profiles")
        .select("id", { count: "exact", head: true })
        .eq("alias", body.data.alias)
        .neq("user_id", request.user.id);
      if ((count ?? 0) > 0) {
        return reply.status(409).send({ code: "ALIAS_TAKEN", message: "That alias is already in use" });
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.data.alias !== undefined) updates["alias"] = body.data.alias;
    if (body.data.bio !== undefined) updates["bio"] = body.data.bio;

    const { data, error } = await supabase
      .from("community_profiles")
      .update(updates)
      .eq("user_id", request.user.id)
      .select()
      .single();

    if (error || !data) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to update profile" });
    }
    return reply.send({ profile: mapProfile(data) });
  });

  fastify.get("/feed", async (request, reply) => {
    const query = CommunityFeedQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: query.error.message });
    }

    const { tab, cursor, limit } = query.data;

    const viewerProfile = await getOrCreateCommunityProfile(request.user.id);

    let q = supabase
      .from("community_posts")
      .select(
        `id, content, excerpt, visibility, is_from_journal, reaction_counts, comment_count, created_at, updated_at,
         community_profiles!inner(id, alias, avatar_seed, bio, followers_count, following_count, post_count, joined_at)`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (tab === "following" && viewerProfile) {
      const { data: follows } = await supabase
        .from("community_follows")
        .select("following_id")
        .eq("follower_id", viewerProfile["id"] as string);
      const ids = (follows ?? []).map((f) => f["following_id"] as string);
      if (!ids.length) return reply.send({ posts: [], nextCursor: null, hasMore: false });
      q = q.in("community_profile_id", ids);
    }

    if (cursor) {
      q = q.lt("created_at", cursor);
    }

    const { data, error } = await q;
    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to fetch feed" });
    }

    const posts = (data ?? []).map((row) => mapPost(row, viewerProfile));
    const hasMore = posts.length === limit;
    const nextCursor = hasMore ? posts[posts.length - 1]?.createdAt ?? null : null;

    return reply.send({ posts, nextCursor, hasMore });
  });

  fastify.post("/posts", async (request, reply) => {
    const body = CreateCommunityPostRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const profile = await getOrCreateCommunityProfile(request.user.id);
    if (!profile) {
      return reply.status(500).send({ code: "PROFILE_ERROR", message: "Failed to get community profile" });
    }

    if (body.data.journalEntryId) {
      const { data: entry } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("id", body.data.journalEntryId)
        .eq("user_id", request.user.id)
        .single();
      if (!entry) {
        return reply.status(403).send({ code: "FORBIDDEN", message: "Entry does not belong to you" });
      }
    }

    const { data: post, error } = await supabase
      .from("community_posts")
      .insert({
        community_profile_id: profile["id"],
        content: body.data.content,
        excerpt: body.data.excerpt ?? truncateExcerpt(body.data.content),
        visibility: body.data.visibility,
        is_from_journal: !!body.data.journalEntryId,
        journal_entry_id: body.data.journalEntryId ?? null,
        reaction_counts: {},
        comment_count: 0,
      })
      .select(
        `*, community_profiles!inner(id, alias, avatar_seed, bio, followers_count, following_count, post_count, joined_at)`,
      )
      .single();

    if (error || !post) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to create post" });
    }

    if (body.data.journalEntryId) {
      await supabase
        .from("journal_entries")
        .update({ is_shared_to_community: true, community_post_id: post["id"] })
        .eq("id", body.data.journalEntryId);
    }

    await queues.communityModeration.add("scan", {
      postId: post["id"],
      content: body.data.content,
    });

    return reply.status(201).send({ post: mapPost(post, profile) });
  });

  fastify.get<{ Params: { postId: string } }>("/posts/:postId", async (request, reply) => {
    const { data, error } = await supabase
      .from("community_posts")
      .select(
        `*, community_profiles!inner(id, alias, avatar_seed, bio, followers_count, following_count, post_count, joined_at)`,
      )
      .eq("id", request.params.postId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Post not found" });
    }
    const viewerProfile = await getOrCreateCommunityProfile(request.user.id);
    return reply.send({ post: mapPost(data, viewerProfile) });
  });

  fastify.delete<{ Params: { postId: string } }>("/posts/:postId", async (request, reply) => {
    const profile = await getOrCreateCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    const { error } = await supabase
      .from("community_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", request.params.postId)
      .eq("community_profile_id", profile["id"] as string);

    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to delete post" });
    }

    await supabase
      .from("journal_entries")
      .update({ is_shared_to_community: false, community_post_id: null })
      .eq("community_post_id", request.params.postId)
      .eq("user_id", request.user.id);

    return reply.status(204).send();
  });

  fastify.get<{ Params: { postId: string } }>("/posts/:postId/comments", async (request, reply) => {
    const { data, error } = await supabase
      .from("community_comments")
      .select(
        `*, community_profiles!inner(id, alias, avatar_seed, bio, followers_count, following_count, post_count, joined_at)`,
      )
      .eq("post_id", request.params.postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to fetch comments" });
    }
    return reply.send({ comments: (data ?? []).map(mapComment), total: data?.length ?? 0 });
  });

  fastify.post<{ Params: { postId: string } }>("/posts/:postId/comments", async (request, reply) => {
    const body = CreateCommentRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const profile = await getOrCreateCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    const { data: comment, error } = await supabase
      .from("community_comments")
      .insert({
        post_id: request.params.postId,
        community_profile_id: profile["id"],
        content: body.data.content,
      })
      .select(
        `*, community_profiles!inner(id, alias, avatar_seed, bio, followers_count, following_count, post_count, joined_at)`,
      )
      .single();

    if (error || !comment) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to create comment" });
    }

    await supabase.rpc("increment_comment_count", { post_id: request.params.postId });
    await queues.communityModeration.add("scan-comment", {
      commentId: comment["id"],
      content: body.data.content,
    });

    return reply.status(201).send({ comment: mapComment(comment) });
  });

  fastify.post<{ Params: { postId: string } }>("/posts/:postId/reactions", async (request, reply) => {
    const body = AddReactionRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const profile = await getOrCreateCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    await supabase
      .from("community_reactions")
      .upsert({
        post_id: request.params.postId,
        community_profile_id: profile["id"],
        reaction: body.data.reaction,
      });

    await supabase.rpc("recalculate_reactions", { post_id: request.params.postId });

    return reply.status(204).send();
  });

  fastify.post<{ Params: { communityUserId: string } }>("/follows/:communityUserId", async (request, reply) => {
    const profile = await getOrCreateCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    if ((profile["id"] as string) === request.params.communityUserId) {
      return reply.status(400).send({ code: "INVALID", message: "Cannot follow yourself" });
    }

    await supabase
      .from("community_follows")
      .upsert({ follower_id: profile["id"], following_id: request.params.communityUserId });

    return reply.status(204).send();
  });

  fastify.delete<{ Params: { communityUserId: string } }>("/follows/:communityUserId", async (request, reply) => {
    const profile = await getOrCreateCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    await supabase
      .from("community_follows")
      .delete()
      .eq("follower_id", profile["id"] as string)
      .eq("following_id", request.params.communityUserId);

    return reply.status(204).send();
  });

  fastify.post("/report", async (request, reply) => {
    const body = ReportRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const profile = await getOrCreateCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    const { error } = await supabase.from("community_reports").insert({
      reporter_profile_id: profile["id"],
      target_type: body.data.targetType,
      target_id: body.data.targetId,
      reason: body.data.reason,
      details: body.data.details ?? null,
      status: "pending",
    });

    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to submit report" });
    }

    await queues.communityModeration.add("review-report", {
      targetType: body.data.targetType,
      targetId: body.data.targetId,
      reason: body.data.reason,
    });

    return reply.status(204).send();
  });
}

async function getOrCreateCommunityProfile(userId: string) {
  const { data } = await supabase
    .from("community_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (data) return data;

  const alias = await generateThemedAlias();
  const { data: created } = await supabase
    .from("community_profiles")
    .insert({
      user_id: userId,
      alias,
      avatar_seed: Math.random().toString(36).slice(2, 10),
    })
    .select()
    .single();
  return created;
}

const CELESTIAL_ADJECTIVES = [
  "Starlit", "Moonlit", "Golden", "Silver", "Cosmic", "Gentle", "Quiet",
  "Soft", "Warm", "Glowing", "Tender", "Radiant", "Misty", "Velvet", "Aurora",
];
const CELESTIAL_NOUNS = [
  "Moon", "Star", "Dawn", "Dusk", "Nova", "Bloom", "Tide", "Glow",
  "Light", "Rose", "Fern", "Mist", "Lune", "Ember", "Sage",
];

async function generateThemedAlias(): Promise<string> {
  const adj = CELESTIAL_ADJECTIVES[Math.floor(Math.random() * CELESTIAL_ADJECTIVES.length)]!;
  const noun = CELESTIAL_NOUNS[Math.floor(Math.random() * CELESTIAL_NOUNS.length)]!;
  const suffix = Math.floor(Math.random() * 999) + 1;
  return `${adj}${noun}${suffix}`;
}

function mapProfile(row: Record<string, unknown>) {
  return {
    id: row["id"],
    alias: row["alias"],
    avatarSeed: row["avatar_seed"],
    bio: row["bio"],
    followersCount: row["followers_count"] ?? 0,
    followingCount: row["following_count"] ?? 0,
    postCount: row["post_count"] ?? 0,
    joinedAt: row["joined_at"] ?? row["created_at"],
  };
}

function mapPost(row: Record<string, unknown>, viewerProfile: Record<string, unknown> | null) {
  const authorProfileRaw = row["community_profiles"] as Record<string, unknown> | undefined;
  return {
    id: row["id"],
    authorProfile: authorProfileRaw ? mapProfile(authorProfileRaw) : null,
    content: row["content"],
    excerpt: row["excerpt"],
    visibility: row["visibility"],
    isFromJournal: row["is_from_journal"],
    reactionCounts: row["reaction_counts"] ?? {},
    commentCount: row["comment_count"] ?? 0,
    viewerReaction: null,
    viewerIsFollowing: false,
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}

function mapComment(row: Record<string, unknown>) {
  const authorProfileRaw = row["community_profiles"] as Record<string, unknown> | undefined;
  return {
    id: row["id"],
    postId: row["post_id"],
    authorProfile: authorProfileRaw ? mapProfile(authorProfileRaw) : null,
    content: row["content"],
    createdAt: row["created_at"],
  };
}

function truncateExcerpt(text: string, maxLen = 280): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}
