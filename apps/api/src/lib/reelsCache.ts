import { getRedis } from "./redis.js";
import { supabase } from "./supabase.js";

const REELS_KEY = "reels:feed:v1";          // sorted set: postId -> score
const REELS_TTL = 90;                        // seconds — refreshed every ~30s by worker
const RANK_LOCK = "reels:rank:lock";

/**
 * Compute fresh ranking from Postgres and cache in Redis.
 * Score = likes*0.4 + saves*0.3 + repost*0.3 + comments*0.2 - dismissals*5
 *         - 1 point per hour of age (recency boost)
 */
export async function refreshReelsCache(): Promise<number> {
  const redis = getRedis();
  const got = await redis.set(RANK_LOCK, "1", "EX", 60, "NX");
  if (!got) return 0;

  const sinceHours = 72;
  const sinceIso = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("community_posts")
    .select("id, like_count, save_count, repost_count, comment_count, view_count, created_at")
    .eq("post_type", "video")
    .is("deleted_at", null)
    .gt("created_at", sinceIso)
    .limit(500);

  if (!rows || !rows.length) {
    // Fall back: still expose the most recent video posts ever
    const { data: fallback } = await supabase
      .from("community_posts")
      .select("id, like_count, save_count, repost_count, comment_count, view_count, created_at")
      .eq("post_type", "video")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!fallback?.length) return 0;
    rows?.push(...fallback);
  }

  // Dismissals (subtract from score)
  const ids = (rows ?? []).map((r) => r["id"] as string);
  const dismissalsByPost = new Map<string, number>();
  if (ids.length) {
    const { data: ds } = await supabase
      .from("community_post_dismissals")
      .select("post_id")
      .in("post_id", ids);
    for (const d of ds ?? []) {
      const id = d["post_id"] as string;
      dismissalsByPost.set(id, (dismissalsByPost.get(id) ?? 0) + 1);
    }
  }

  const now = Date.now();
  const pipeline = redis.pipeline();
  pipeline.del(REELS_KEY);
  for (const r of rows ?? []) {
    const id = r["id"] as string;
    const ageHours = (now - new Date(r["created_at"] as string).getTime()) / 3600_000;
    const score =
      (r["like_count"] as number ?? 0) * 0.4 +
      (r["save_count"] as number ?? 0) * 0.3 +
      (r["repost_count"] as number ?? 0) * 0.3 +
      (r["comment_count"] as number ?? 0) * 0.2 +
      Math.log10(Math.max((r["view_count"] as number) ?? 1, 1)) * 0.5 -
      (dismissalsByPost.get(id) ?? 0) * 5 -
      ageHours;
    pipeline.zadd(REELS_KEY, score, id);
  }
  pipeline.expire(REELS_KEY, REELS_TTL);
  await pipeline.exec();

  return rows?.length ?? 0;
}

/** Pull a slice of ranked reel ids. */
export async function getReelsSlice(offset: number, count: number): Promise<{ ids: string[]; cold: boolean }> {
  const redis = getRedis();
  const total = await redis.zcard(REELS_KEY);
  if (total === 0) {
    return { ids: [], cold: true };
  }
  const ids = await redis.zrevrange(REELS_KEY, offset, offset + count - 1);
  return { ids, cold: false };
}
