import { Worker } from "bullmq";
import pino from "pino";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { generatePartnerInsightCard } from "../providers/claude.js";
import { env } from "../lib/env.js";

const log = pino({ level: "info" });

interface PartnerInsightJobData {
  userId: string;
  weekStart: string;
  weekEnd: string;
}

export function startPartnerInsightWorker() {
  const worker = new Worker<PartnerInsightJobData>(
    "partnerinsight.generate",
    async (job) => {
      const { userId, weekStart, weekEnd } = job.data;
      log.info({ jobId: job.id, userId }, "Generating partner insight");

      const { data: entries, error } = await supabase
        .from("journal_entries")
        .select("content, mood_tags")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte("created_at", `${weekStart}T00:00:00Z`)
        .lte("created_at", `${weekEnd}T23:59:59Z`);

      if (error) throw new Error(`DB error: ${error.message}`);
      if (!entries?.length) {
        log.info({ jobId: job.id, userId }, "No entries for partner insight — skipping");
        return;
      }

      const result = await generatePartnerInsightCard(
        entries.map((e) => ({
          content: e["content"] as string,
          moodTags: (e["mood_tags"] as string[]) ?? [],
        })),
      );

      await supabase.from("partner_insights").upsert({
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd,
        card_text: result.cardText,
        needs_list: result.needsList,
        generated_at: new Date().toISOString(),
      });

      log.info({ jobId: job.id, userId }, "Partner insight complete");
    },
    { connection: redis, concurrency: env.CONCURRENCY },
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Partner insight job failed");
  });
}
