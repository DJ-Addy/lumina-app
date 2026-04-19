import { getRedis } from "./redis.js";
import { supabase } from "./supabase.js";

const VIEWS_HASH = "views:posts:pending";  // hash: postId -> count
const FLUSH_LOCK = "views:flush:lock";

export async function incrementPostView(postId: string): Promise<void> {
  await getRedis().hincrby(VIEWS_HASH, postId, 1);
}

export async function incrementMediaView(mediaId: string): Promise<void> {
  await getRedis().hincrby("views:media:pending", mediaId, 1);
}

/**
 * Flush pending view counts to Postgres in a batch. Designed to be called
 * every ~60s by the worker scheduler, behind a 2-minute distributed lock to
 * prevent two workers from racing.
 */
export async function flushPendingViews(): Promise<{ posts: number; media: number }> {
  const redis = getRedis();
  const locked = await redis.set(FLUSH_LOCK, "1", "EX", 120, "NX");
  if (!locked) return { posts: 0, media: 0 };

  try {
    const [postViews, mediaViews] = await Promise.all([
      redis.hgetall(VIEWS_HASH),
      redis.hgetall("views:media:pending"),
    ]);

    const postPairs = Object.entries(postViews ?? {});
    const mediaPairs = Object.entries(mediaViews ?? {});

    if (postPairs.length) {
      const payload = postPairs.map(([post_id, delta]) => ({ post_id, delta: parseInt(delta, 10) }));
      await supabase.rpc("batch_increment_post_views", { p_pairs: payload });
      await redis.del(VIEWS_HASH);
    }
    if (mediaPairs.length) {
      // Direct UPDATE per media row — small batch
      for (const [id, deltaStr] of mediaPairs) {
        const delta = parseInt(deltaStr, 10);
        if (delta > 0) {
          await supabase
            .from("community_media")
            .update({ view_count: delta })
            .eq("id", id);
        }
      }
      await redis.del("views:media:pending");
    }

    return { posts: postPairs.length, media: mediaPairs.length };
  } finally {
    // Lock auto-expires; do not delete it here (gives breathing room)
  }
}
