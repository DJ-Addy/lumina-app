import { Queue, Worker } from "bullmq";
import pino from "pino";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";

const log = pino({ level: "info" });

const QUEUE = "community.feed.rank";
const REELS_KEY = "reels:feed:v1";
const VIEWS_HASH = "views:posts:pending";

/**
 * Worker that re-ranks the reels feed and flushes view counters.
 * Scheduled every 30s via BullMQ repeatable job.
 */
export function startFeedRankWorker() {
  const queue = new Queue(QUEUE, { connection: redis });
  void queue.add(
    "rank",
    {},
    { repeat: { every: 30_000 }, removeOnComplete: 50, removeOnFail: 50 },
  );

  const worker = new Worker(
    QUEUE,
    async (job) => {
      if (job.name === "rank") {
        await Promise.all([refreshReelsCache(), flushViewCounters()]);
      }
    },
    { connection: redis, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Feed rank job failed");
  });
}

async function refreshReelsCache(): Promise<void> {
  const sinceIso = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const { data: rows } = await supabase
    .from("community_posts")
    .select("id, like_count, save_count, repost_count, comment_count, view_count, created_at")
    .eq("post_type", "video")
    .is("deleted_at", null)
    .gt("created_at", sinceIso)
    .limit(500);
  if (!rows?.length) return;

  const ids = rows.map((r) => r["id"] as string);
  const dismissals = new Map<string, number>();
  const { data: ds } = await supabase
    .from("community_post_dismissals")
    .select("post_id")
    .in("post_id", ids);
  for (const d of ds ?? []) {
    const id = d["post_id"] as string;
    dismissals.set(id, (dismissals.get(id) ?? 0) + 1);
  }

  const now = Date.now();
  const pipeline = redis.pipeline();
  pipeline.del(REELS_KEY);
  for (const r of rows) {
    const id = r["id"] as string;
    const ageHours = (now - new Date(r["created_at"] as string).getTime()) / 3600_000;
    const score =
      ((r["like_count"] as number) ?? 0) * 0.4 +
      ((r["save_count"] as number) ?? 0) * 0.3 +
      ((r["repost_count"] as number) ?? 0) * 0.3 +
      ((r["comment_count"] as number) ?? 0) * 0.2 +
      Math.log10(Math.max((r["view_count"] as number) ?? 1, 1)) * 0.5 -
      (dismissals.get(id) ?? 0) * 5 -
      ageHours;
    pipeline.zadd(REELS_KEY, score, id);
  }
  pipeline.expire(REELS_KEY, 90);
  await pipeline.exec();
  log.info({ count: rows.length }, "Reels cache refreshed");
}

async function flushViewCounters(): Promise<void> {
  const views = (await redis.hgetall(VIEWS_HASH)) as Record<string, string>;
  const pairs = Object.entries(views);
  if (!pairs.length) return;
  const payload = pairs.map(([post_id, delta]) => ({ post_id, delta: parseInt(String(delta), 10) }));
  await supabase.rpc("batch_increment_post_views", { p_pairs: payload });
  await redis.del(VIEWS_HASH);
  log.info({ posts: pairs.length }, "Flushed view counters");
}
