import { Worker } from "bullmq";
import pino from "pino";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { env } from "../lib/env.js";

const log = pino({ level: "info" });

const FLAGGED_PATTERNS = [
  /\b(kill|harm|suicide|self.harm|end.my.life)\b/i,
  /\b(hurt myself|don't want to be here)\b/i,
];

interface ModerationScanJobData {
  postId?: string;
  commentId?: string;
  content: string;
}

interface ReviewReportJobData {
  targetType: string;
  targetId: string;
  reason: string;
}

export function startCommunityWorkers() {
  const scanWorker = new Worker<ModerationScanJobData>(
    "community.moderation.scan",
    async (job) => {
      const { content, postId, commentId } = job.data;
      const jobName = job.name;

      const isFlagged = FLAGGED_PATTERNS.some((p) => p.test(content));

      if (isFlagged) {
        log.warn({ jobId: job.id, postId, commentId }, "Content flagged for review");

        await supabase.from("community_reports").insert({
          reporter_profile_id: null,
          target_type: jobName === "scan-comment" ? "comment" : "post",
          target_id: (postId ?? commentId)!,
          reason: "harmful_content",
          details: "Auto-flagged by moderation scan",
          status: "pending",
        });

        if (postId) {
          await supabase
            .from("community_posts")
            .update({ is_under_review: true })
            .eq("id", postId);
        }
        if (commentId) {
          await supabase
            .from("community_comments")
            .update({ is_under_review: true })
            .eq("id", commentId);
        }
      }
    },
    { connection: redis, concurrency: env.CONCURRENCY },
  );

  const reportWorker = new Worker<ReviewReportJobData>(
    "community.moderation.scan",
    async (job) => {
      if (job.name !== "review-report") return;
      log.info({ jobId: job.id, targetId: job.data.targetId }, "Report received for review");
    },
    { connection: redis, concurrency: 1 },
  );

  scanWorker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Community moderation job failed");
  });

  reportWorker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Community report job failed");
  });
}
