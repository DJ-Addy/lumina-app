import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  CreateCommunityPostRequestSchema,
  CommunityFeedQuerySchema,
  CreateCommentRequestSchema,
  AddReactionRequestSchema,
  ReportRequestSchema,
  UpdateCommunityProfileRequestSchema,
  DismissPostRequestSchema,
  CastVoteRequestSchema,
} from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import { queues } from "../lib/queue.js";
import {
  getCommunityProfile,
  mapProfile,
  mapPost,
  mapComment,
  hydratePosts,
  truncateExcerpt,
  POST_SELECT,
} from "./communityHelpers.js";
import { incrementReportCounter } from "../lib/reportsCounter.js";
import { moderateText } from "../lib/textModeration.js";

export async function communityRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireActiveCommunityProfile);

  // ============================================================
  // PROFILE
  // ============================================================
  fastify.get("/profile/me", async (request, reply) => {
    const data = await getCommunityProfile(request.user.id);
    if (!data) return reply.status(500).send({ code: "DB_ERROR", message: "Failed to load profile" });
    return reply.send({ profile: mapProfile(data as Record<string, unknown>) });
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

  // ============================================================
  // FEED
  // ============================================================
  fastify.get("/feed", async (request, reply) => {
    const query = CommunityFeedQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: query.error.message });
    }
    const { tab, cursor, limit, postType } = query.data;
    const viewerProfile = await getCommunityProfile(request.user.id);
    const viewerProfileId = (viewerProfile?.["id"] as string | undefined) ?? null;

    if (tab === "saved") {
      if (!viewerProfileId) return reply.send({ posts: [], nextCursor: null, hasMore: false });
      const { data: saves } = await supabase
        .from("community_post_saves")
        .select("post_id, created_at")
        .eq("community_profile_id", viewerProfileId)
        .order("created_at", { ascending: false })
        .limit(limit);
      const ids = (saves ?? []).map((s) => s["post_id"] as string);
      if (!ids.length) return reply.send({ posts: [], nextCursor: null, hasMore: false });
      const { data: rows } = await supabase
        .from("community_posts")
        .select(POST_SELECT)
        .in("id", ids)
        .is("deleted_at", null);
      const ctx = await hydratePosts((rows ?? []) as Array<Record<string, unknown>>, viewerProfileId);
      const posts = ((rows ?? []) as Array<Record<string, unknown>>).map((row) =>
        mapPost(row, { viewerProfile, ...ctx }),
      );
      return reply.send({ posts, nextCursor: null, hasMore: false });
    }

    let q = supabase
      .from("community_posts")
      .select(POST_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (postType) q = q.eq("post_type", postType);

    if (tab === "following" && viewerProfile) {
      const { data: follows } = await supabase
        .from("community_follows")
        .select("following_id")
        .eq("follower_id", viewerProfile["id"] as string);
      const ids = (follows ?? []).map((f) => f["following_id"] as string);
      if (!ids.length) return reply.send({ posts: [], nextCursor: null, hasMore: false });
      q = q.in("community_profile_id", ids);
    }
    if (cursor) q = q.lt("created_at", cursor);

    // Filter out dismissed posts
    if (viewerProfileId) {
      const { data: dismissed } = await supabase
        .from("community_post_dismissals")
        .select("post_id")
        .eq("community_profile_id", viewerProfileId);
      const dismissedIds = (dismissed ?? []).map((d) => d["post_id"] as string);
      if (dismissedIds.length) q = q.not("id", "in", `(${dismissedIds.join(",")})`);
    }

    const { data, error } = await q;
    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to fetch feed" });
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const ctx = await hydratePosts(rows, viewerProfileId);
    const posts = rows.map((row) => mapPost(row, { viewerProfile, ...ctx }));
    const hasMore = posts.length === limit;
    const nextCursor = hasMore ? posts[posts.length - 1]?.createdAt ?? null : null;
    return reply.send({ posts, nextCursor, hasMore });
  });

  // ============================================================
  // POSTS — create / read / delete
  // ============================================================
  fastify.post("/posts", async (request, reply) => {
    const body = CreateCommunityPostRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    const data = body.data;

    // Verify journal ownership
    if (data.journalEntryId) {
      const { data: entry } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("id", data.journalEntryId)
        .eq("user_id", request.user.id)
        .single();
      if (!entry) {
        return reply.status(403).send({ code: "FORBIDDEN", message: "Entry does not belong to you" });
      }
    }

    // Verify uploaded media belongs to this user and is ready (or processing for video)
    if (data.mediaIds?.length) {
      const { data: mediaRows } = await supabase
        .from("community_media")
        .select("id, kind, status, community_profile_id")
        .in("id", data.mediaIds);
      const ok = (mediaRows ?? []).every(
        (m) => m["community_profile_id"] === profile["id"] && m["status"] !== "deleted" && m["status"] !== "failed",
      );
      if (!ok || (mediaRows?.length ?? 0) !== data.mediaIds.length) {
        return reply.status(400).send({ code: "INVALID_MEDIA", message: "One or more media not available" });
      }
    }

    // Server-side text moderation (defense in depth — client also screens).
    // Combine all human-authored text the user submitted into one pass.
    const textToCheck = [
      data.content ?? "",
      data.poll?.question ?? "",
      ...(data.poll?.options ?? []),
    ]
      .filter(Boolean)
      .join("\n");
    let modLabels: { label: string; score: number }[] = [];
    let modReason: string | null = null;
    if (textToCheck.length > 0) {
      const mod = await moderateText(textToCheck);
      modLabels = mod.labels;
      modReason = mod.reason ?? null;
      if (mod.severity === "block") {
        return reply.status(422).send({
          code: "CONTENT_REJECTED",
          message: mod.reason ?? "Content violates community guidelines",
          labels: mod.labels,
        });
      }
      // crisis & warn are allowed through — client handles UX. We still
      // record the labels so reviewers can audit.
    }

    // Verify repost target exists
    if (data.repostOfId) {
      const { data: target } = await supabase
        .from("community_posts")
        .select("id")
        .eq("id", data.repostOfId)
        .is("deleted_at", null)
        .single();
      if (!target) return reply.status(404).send({ code: "NOT_FOUND", message: "Repost target not found" });
    }

    // Create poll first if needed
    let pollId: string | null = null;
    if (data.poll) {
      const optionRows = data.poll.options.map((label, i) => ({
        id: String.fromCharCode(97 + i),
        label,
      }));
      const endsAt = data.poll.endsInHours
        ? new Date(Date.now() + data.poll.endsInHours * 3600 * 1000).toISOString()
        : null;
      const { data: poll, error: pollErr } = await supabase
        .from("community_polls")
        .insert({
          id: randomUUID(),
          question: data.poll.question,
          options: optionRows,
          ends_at: endsAt,
          vote_counts: Object.fromEntries(optionRows.map((o) => [o.id, 0])),
        })
        .select("id")
        .single();
      if (pollErr || !poll) {
        return reply.status(500).send({ code: "DB_ERROR", message: "Failed to create poll" });
      }
      pollId = poll["id"] as string;
    }

    const insertRow: Record<string, unknown> = {
      community_profile_id: profile["id"],
      post_type: data.postType,
      content: data.content ?? null,
      excerpt: data.excerpt ?? (data.content ? truncateExcerpt(data.content) : null),
      visibility: data.visibility,
      is_from_journal: !!data.journalEntryId,
      journal_entry_id: data.journalEntryId ?? null,
      media_ids: data.mediaIds ?? [],
      repost_of_id: data.repostOfId ?? null,
      poll_id: pollId,
      reaction_counts: {},
      comment_count: 0,
      moderation_labels: modLabels,
      moderation_reason: modReason,
      moderation_checked_at: new Date().toISOString(),
    };

    const { data: post, error } = await supabase
      .from("community_posts")
      .insert(insertRow)
      .select(POST_SELECT)
      .single();
    if (error || !post) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to create post" });
    }

    if (data.journalEntryId) {
      await supabase
        .from("journal_entries")
        .update({ is_shared_to_community: true, community_post_id: post["id"] })
        .eq("id", data.journalEntryId);
    }

    if (data.content) {
      await queues.communityModeration.add("scan", {
        postId: post["id"],
        content: data.content,
      });
    }

    const rows = [post as Record<string, unknown>];
    const ctx = await hydratePosts(rows, profile["id"] as string);
    return reply.status(201).send({ post: mapPost(post as Record<string, unknown>, { viewerProfile: profile, ...ctx }) });
  });

  fastify.get<{ Params: { postId: string } }>("/posts/:postId", async (request, reply) => {
    const { data, error } = await supabase
      .from("community_posts")
      .select(POST_SELECT)
      .eq("id", request.params.postId)
      .is("deleted_at", null)
      .single();
    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Post not found" });
    }
    const viewerProfile = await getCommunityProfile(request.user.id);
    const viewerProfileId = (viewerProfile?.["id"] as string | undefined) ?? null;
    const ctx = await hydratePosts([data as Record<string, unknown>], viewerProfileId);
    return reply.send({ post: mapPost(data as Record<string, unknown>, { viewerProfile, ...ctx }) });
  });

  fastify.delete<{ Params: { postId: string } }>("/posts/:postId", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
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

  // ============================================================
  // SAVES (bookmarks)
  // ============================================================
  fastify.post<{ Params: { postId: string } }>("/posts/:postId/save", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });
    await supabase
      .from("community_post_saves")
      .upsert({ community_profile_id: profile["id"], post_id: request.params.postId });
    return reply.status(204).send();
  });

  fastify.delete<{ Params: { postId: string } }>("/posts/:postId/save", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });
    await supabase
      .from("community_post_saves")
      .delete()
      .eq("community_profile_id", profile["id"] as string)
      .eq("post_id", request.params.postId);
    return reply.status(204).send();
  });

  // ============================================================
  // DISMISS ("not interested")
  // ============================================================
  fastify.post<{ Params: { postId: string } }>("/posts/:postId/dismiss", async (request, reply) => {
    const body = DismissPostRequestSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    await supabase.from("community_post_dismissals").upsert({
      community_profile_id: profile["id"],
      post_id: request.params.postId,
      reason: body.data.reason ?? "not_interested",
    });
    return reply.status(204).send();
  });

  // ============================================================
  // VIEW PING (used by reels)
  // ============================================================
  fastify.post<{ Params: { postId: string } }>("/posts/:postId/view", async (request, reply) => {
    // We optimistically increment in Redis; pg_cron flushes nightly.
    const { incrementPostView } = await import("../lib/viewsCounter.js");
    await incrementPostView(request.params.postId);
    return reply.status(204).send();
  });

  // ============================================================
  // COMMENTS
  // ============================================================
  fastify.get<{ Params: { postId: string } }>("/posts/:postId/comments", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
    const viewerId = (profile?.["id"] as string | undefined) ?? null;
    const { data, error } = await supabase
      .from("community_comments")
      .select(`*, community_profiles!inner(id, alias, avatar_seed, bio, followers_count, following_count, post_count, joined_at, suspended_at)`)
      .eq("post_id", request.params.postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to fetch comments" });
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    let likedSet = new Set<string>();
    if (viewerId && rows.length) {
      const { data: likes } = await supabase
        .from("community_comment_likes")
        .select("comment_id")
        .eq("community_profile_id", viewerId)
        .in("comment_id", rows.map((r) => r["id"] as string));
      likedSet = new Set((likes ?? []).map((l) => l["comment_id"] as string));
    }
    return reply.send({
      comments: rows.map((r) => mapComment(r, likedSet.has(r["id"] as string))),
      total: rows.length,
    });
  });

  fastify.post<{ Params: { postId: string } }>("/posts/:postId/comments", async (request, reply) => {
    const body = CreateCommentRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    const mod = await moderateText(body.data.content);
    if (mod.severity === "block") {
      return reply.status(422).send({
        code: "CONTENT_REJECTED",
        message: mod.reason ?? "Comment violates community guidelines",
        labels: mod.labels,
      });
    }

    const { data: comment, error } = await supabase
      .from("community_comments")
      .insert({
        post_id: request.params.postId,
        community_profile_id: profile["id"],
        content: body.data.content,
        moderation_labels: mod.labels,
        moderation_reason: mod.reason ?? null,
        moderation_checked_at: new Date().toISOString(),
      })
      .select(`*, community_profiles!inner(id, alias, avatar_seed, bio, followers_count, following_count, post_count, joined_at, suspended_at)`)
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

  fastify.post<{ Params: { commentId: string } }>("/comments/:commentId/like", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });
    const { error } = await supabase
      .from("community_comment_likes")
      .upsert({ community_profile_id: profile["id"], comment_id: request.params.commentId });
    if (!error) {
      await supabase.rpc("bump_post_counter", {
        p_post_id: request.params.commentId,
        p_field: "like_count",
        p_delta: 1,
      });
      // Fallback if rpc unavailable: direct update
      await supabase
        .from("community_comments")
        .update({ like_count: (await currentCommentLikes(request.params.commentId)) })
        .eq("id", request.params.commentId);
    }
    return reply.status(204).send();
  });

  fastify.delete<{ Params: { commentId: string } }>("/comments/:commentId/like", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });
    await supabase
      .from("community_comment_likes")
      .delete()
      .eq("community_profile_id", profile["id"] as string)
      .eq("comment_id", request.params.commentId);
    await supabase
      .from("community_comments")
      .update({ like_count: (await currentCommentLikes(request.params.commentId)) })
      .eq("id", request.params.commentId);
    return reply.status(204).send();
  });

  // ============================================================
  // REACTIONS (likes)
  // ============================================================
  fastify.post<{ Params: { postId: string } }>("/posts/:postId/reactions", async (request, reply) => {
    const body = AddReactionRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }
    const profile = await getCommunityProfile(request.user.id);
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

  fastify.delete<{ Params: { postId: string } }>("/posts/:postId/reactions", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });
    await supabase
      .from("community_reactions")
      .delete()
      .eq("post_id", request.params.postId)
      .eq("community_profile_id", profile["id"] as string);
    await supabase.rpc("recalculate_reactions", { post_id: request.params.postId });
    return reply.status(204).send();
  });

  // ============================================================
  // POLLS — vote
  // ============================================================
  fastify.post<{ Params: { pollId: string } }>("/polls/:pollId/vote", async (request, reply) => {
    const body = CastVoteRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });

    const { data: poll } = await supabase
      .from("community_polls")
      .select("id, options, ends_at")
      .eq("id", request.params.pollId)
      .single();
    if (!poll) return reply.status(404).send({ code: "NOT_FOUND", message: "Poll not found" });
    if (poll["ends_at"] && new Date(poll["ends_at"] as string).getTime() < Date.now()) {
      return reply.status(400).send({ code: "POLL_CLOSED", message: "This poll has ended" });
    }
    const optionExists = (poll["options"] as Array<{ id: string }>).some((o) => o.id === body.data.optionId);
    if (!optionExists) return reply.status(400).send({ code: "INVALID_OPTION", message: "Unknown option" });

    const { error } = await supabase.rpc("cast_poll_vote", {
      p_poll_id: request.params.pollId,
      p_profile_id: profile["id"],
      p_option_id: body.data.optionId,
    });
    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to record vote" });
    }
    return reply.status(204).send();
  });

  // ============================================================
  // FOLLOWS
  // ============================================================
  fastify.post<{ Params: { communityUserId: string } }>("/follows/:communityUserId", async (request, reply) => {
    const profile = await getCommunityProfile(request.user.id);
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
    const profile = await getCommunityProfile(request.user.id);
    if (!profile) return reply.status(500).send({ code: "PROFILE_ERROR", message: "Profile error" });
    await supabase
      .from("community_follows")
      .delete()
      .eq("follower_id", profile["id"] as string)
      .eq("following_id", request.params.communityUserId);
    return reply.status(204).send();
  });

  // ============================================================
  // REPORTS
  // ============================================================
  fastify.post("/report", async (request, reply) => {
    const body = ReportRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }
    const profile = await getCommunityProfile(request.user.id);
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

    // Increment Redis counter — worker will check threshold
    const newCount = await incrementReportCounter(body.data.targetType, body.data.targetId);

    await queues.communityReports.add("review", {
      targetType: body.data.targetType,
      targetId: body.data.targetId,
      reason: body.data.reason,
      reportCount: newCount,
    });

    return reply.status(204).send();
  });
}

async function currentCommentLikes(commentId: string): Promise<number> {
  const { count } = await supabase
    .from("community_comment_likes")
    .select("comment_id", { count: "exact", head: true })
    .eq("comment_id", commentId);
  return count ?? 0;
}
