import { supabase } from "../lib/supabase.js";
import { publicUrl } from "../lib/storage.js";
import type {
  CommunityMedia,
  CommunityMediaVariant,
  CommunityPoll,
  CommunityPost,
  CommunityPostLite,
} from "@lumina/shared";

const PROFILE_COLS = `id, alias, avatar_seed, bio, followers_count, following_count, post_count, joined_at, suspended_at`;

export async function getCommunityProfile(userId: string) {
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

export async function generateThemedAlias(): Promise<string> {
  const ADJ = [
    "Starlit", "Moonlit", "Golden", "Silver", "Cosmic", "Gentle", "Quiet",
    "Soft", "Warm", "Glowing", "Tender", "Radiant", "Misty", "Velvet", "Aurora",
  ];
  const NOUN = [
    "Moon", "Star", "Dawn", "Dusk", "Nova", "Bloom", "Tide", "Glow",
    "Light", "Rose", "Fern", "Mist", "Lune", "Ember", "Sage",
  ];
  const adj = ADJ[Math.floor(Math.random() * ADJ.length)]!;
  const noun = NOUN[Math.floor(Math.random() * NOUN.length)]!;
  const suffix = Math.floor(Math.random() * 999) + 1;
  return `${adj}${noun}${suffix}`;
}

export function mapProfile(row: Record<string, unknown>) {
  return {
    id: row["id"] as string,
    alias: row["alias"] as string,
    avatarSeed: row["avatar_seed"] as string,
    bio: (row["bio"] as string | null) ?? null,
    followersCount: (row["followers_count"] as number | null) ?? 0,
    followingCount: (row["following_count"] as number | null) ?? 0,
    postCount: (row["post_count"] as number | null) ?? 0,
    joinedAt: (row["joined_at"] ?? row["created_at"]) as string,
    isSuspended: !!row["suspended_at"],
  };
}

export function mapMedia(row: Record<string, unknown>): CommunityMedia {
  const variants = (row["variants"] as CommunityMediaVariant[] | null) ?? [];
  const enrichedVariants: CommunityMediaVariant[] = variants.map((v) => ({
    ...v,
    url: v.url ?? publicUrl(v.key) ?? undefined,
  }));
  return {
    id: row["id"] as string,
    kind: row["kind"] as "image" | "video",
    status: row["status"] as CommunityMedia["status"],
    url: publicUrl(row["storage_key"] as string),
    thumbnailUrl: publicUrl(row["thumbnail_key"] as string | null),
    width: (row["width"] as number | null) ?? null,
    height: (row["height"] as number | null) ?? null,
    durationMs: (row["duration_ms"] as number | null) ?? null,
    bytes: (row["bytes"] as number | null) ?? null,
    mimeType: (row["mime_type"] as string | null) ?? null,
    variants: enrichedVariants,
  };
}

export function mapPoll(
  row: Record<string, unknown> | null | undefined,
  viewerVote?: string | null,
): CommunityPoll | null {
  if (!row) return null;
  return {
    id: row["id"] as string,
    question: row["question"] as string,
    options: row["options"] as CommunityPoll["options"],
    totalVotes: (row["total_votes"] as number | null) ?? 0,
    voteCounts: (row["vote_counts"] as Record<string, number> | null) ?? {},
    endsAt: (row["ends_at"] as string | null) ?? null,
    viewerVote: viewerVote ?? null,
  };
}

export interface PostMapContext {
  viewerProfile: { id: string } | Record<string, unknown> | null;
  mediaById?: Map<string, CommunityMedia>;
  pollsById?: Map<string, CommunityPoll>;
  repostsById?: Map<string, CommunityPostLite>;
  savedIds?: Set<string>;
  repostedIds?: Set<string>;
  reactionsByPostId?: Map<string, string>;
}

export function mapPost(row: Record<string, unknown>, ctx: PostMapContext): CommunityPost {
  const authorRaw = row["community_profiles"] as Record<string, unknown> | undefined;
  const author = authorRaw ? mapProfile(authorRaw) : null;

  const mediaIds = (row["media_ids"] as string[] | null) ?? [];
  const media = ctx.mediaById
    ? mediaIds.map((id) => ctx.mediaById!.get(id)).filter((m): m is CommunityMedia => !!m)
    : [];

  const pollId = row["poll_id"] as string | null;
  const poll = pollId && ctx.pollsById ? ctx.pollsById.get(pollId) ?? null : null;

  const repostOfId = row["repost_of_id"] as string | null;
  const repostOf = repostOfId && ctx.repostsById ? ctx.repostsById.get(repostOfId) ?? null : null;

  const postId = row["id"] as string;
  return {
    id: postId,
    postType: (row["post_type"] as CommunityPost["postType"]) ?? "text",
    authorProfile: author!,
    content: (row["content"] as string | null) ?? null,
    excerpt: (row["excerpt"] as string | null) ?? null,
    visibility: row["visibility"] as CommunityPost["visibility"],
    isFromJournal: !!row["is_from_journal"],
    media,
    poll,
    repostOf,
    reactionCounts: (row["reaction_counts"] as Record<string, number> | null) ?? {},
    commentCount: (row["comment_count"] as number | null) ?? 0,
    likeCount: (row["like_count"] as number | null) ?? 0,
    saveCount: (row["save_count"] as number | null) ?? 0,
    repostCount: (row["repost_count"] as number | null) ?? 0,
    viewCount: Number((row["view_count"] as number | bigint | null) ?? 0),
    viewerReaction: (ctx.reactionsByPostId?.get(postId) as CommunityPost["viewerReaction"]) ?? null,
    viewerIsFollowing: false,
    viewerHasSaved: ctx.savedIds?.has(postId) ?? false,
    viewerHasReposted: ctx.repostedIds?.has(postId) ?? false,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export function mapPostLite(row: Record<string, unknown>, mediaById: Map<string, CommunityMedia>): CommunityPostLite {
  const authorRaw = row["community_profiles"] as Record<string, unknown> | undefined;
  const author = authorRaw ? mapProfile(authorRaw) : null;
  const mediaIds = (row["media_ids"] as string[] | null) ?? [];
  const media = mediaIds.map((id) => mediaById.get(id)).filter((m): m is CommunityMedia => !!m);
  return {
    id: row["id"] as string,
    postType: (row["post_type"] as CommunityPostLite["postType"]) ?? "text",
    authorProfile: author!,
    content: (row["content"] as string | null) ?? null,
    excerpt: (row["excerpt"] as string | null) ?? null,
    media,
    createdAt: row["created_at"] as string,
  };
}

export function mapComment(row: Record<string, unknown>, viewerHasLiked = false) {
  const authorRaw = row["community_profiles"] as Record<string, unknown> | undefined;
  return {
    id: row["id"] as string,
    postId: row["post_id"] as string,
    authorProfile: authorRaw ? mapProfile(authorRaw) : null,
    content: row["content"] as string,
    likeCount: (row["like_count"] as number | null) ?? 0,
    viewerHasLiked,
    createdAt: row["created_at"] as string,
  };
}

export function truncateExcerpt(text: string, maxLen = 280): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

export const POST_SELECT = `
  id, post_type, content, excerpt, visibility, is_from_journal,
  media_ids, repost_of_id, poll_id, view_count, like_count,
  save_count, repost_count, report_count, reaction_counts,
  comment_count, created_at, updated_at, deleted_at,
  community_profiles!inner(${PROFILE_COLS})
`;

/** Hydrate the media + polls + reposts referenced by a batch of posts. */
export async function hydratePosts(
  rows: Array<Record<string, unknown>>,
  viewerProfileId: string | null,
): Promise<{
  mediaById: Map<string, CommunityMedia>;
  pollsById: Map<string, CommunityPoll>;
  repostsById: Map<string, CommunityPostLite>;
  savedIds: Set<string>;
  repostedIds: Set<string>;
  reactionsByPostId: Map<string, string>;
}> {
  const mediaIds = new Set<string>();
  const pollIds = new Set<string>();
  const repostIds = new Set<string>();
  for (const row of rows) {
    for (const id of (row["media_ids"] as string[] | null) ?? []) mediaIds.add(id);
    if (row["poll_id"]) pollIds.add(row["poll_id"] as string);
    if (row["repost_of_id"]) repostIds.add(row["repost_of_id"] as string);
  }

  // Repost targets — fetch + their media too
  let repostMediaIds = new Set<string>();
  let repostRows: Array<Record<string, unknown>> = [];
  if (repostIds.size) {
    const { data } = await supabase
      .from("community_posts")
      .select(POST_SELECT)
      .in("id", Array.from(repostIds))
      .is("deleted_at", null);
    repostRows = (data as Array<Record<string, unknown>> | null) ?? [];
    for (const r of repostRows) {
      for (const id of (r["media_ids"] as string[] | null) ?? []) repostMediaIds.add(id);
    }
  }

  const allMediaIds = new Set<string>([...mediaIds, ...repostMediaIds]);
  const mediaById = new Map<string, CommunityMedia>();
  if (allMediaIds.size) {
    const { data } = await supabase
      .from("community_media")
      .select("*")
      .in("id", Array.from(allMediaIds))
      .neq("status", "deleted");
    for (const m of (data ?? []) as Array<Record<string, unknown>>) {
      mediaById.set(m["id"] as string, mapMedia(m));
    }
  }

  // Polls + viewer votes
  const pollsById = new Map<string, CommunityPoll>();
  if (pollIds.size) {
    const { data } = await supabase.from("community_polls").select("*").in("id", Array.from(pollIds));
    let viewerVotes = new Map<string, string>();
    if (viewerProfileId) {
      const { data: votes } = await supabase
        .from("community_poll_votes")
        .select("poll_id, option_id")
        .eq("community_profile_id", viewerProfileId)
        .in("poll_id", Array.from(pollIds));
      viewerVotes = new Map((votes ?? []).map((v) => [v["poll_id"] as string, v["option_id"] as string]));
    }
    for (const p of (data ?? []) as Array<Record<string, unknown>>) {
      const id = p["id"] as string;
      const poll = mapPoll(p, viewerVotes.get(id) ?? null);
      if (poll) pollsById.set(id, poll);
    }
  }

  const repostsById = new Map<string, CommunityPostLite>();
  for (const r of repostRows) {
    repostsById.set(r["id"] as string, mapPostLite(r, mediaById));
  }

  // Viewer-only data
  const savedIds = new Set<string>();
  const repostedIds = new Set<string>();
  const reactionsByPostId = new Map<string, string>();

  if (viewerProfileId && rows.length) {
    const ids = rows.map((r) => r["id"] as string);
    const [{ data: saves }, { data: reactions }, { data: reposts }] = await Promise.all([
      supabase
        .from("community_post_saves")
        .select("post_id")
        .eq("community_profile_id", viewerProfileId)
        .in("post_id", ids),
      supabase
        .from("community_reactions")
        .select("post_id, reaction")
        .eq("community_profile_id", viewerProfileId)
        .in("post_id", ids),
      supabase
        .from("community_posts")
        .select("repost_of_id")
        .eq("community_profile_id", viewerProfileId)
        .in("repost_of_id", ids)
        .is("deleted_at", null),
    ]);

    for (const s of saves ?? []) savedIds.add(s["post_id"] as string);
    for (const r of reactions ?? []) reactionsByPostId.set(r["post_id"] as string, r["reaction"] as string);
    for (const r of reposts ?? []) repostedIds.add(r["repost_of_id"] as string);
  }

  return { mediaById, pollsById, repostsById, savedIds, repostedIds, reactionsByPostId };
}
