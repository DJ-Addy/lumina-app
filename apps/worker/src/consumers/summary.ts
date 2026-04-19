import { Worker } from "bullmq";
import pino from "pino";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { generateSummary } from "../providers/claude.js";
import { env } from "../lib/env.js";

const log = pino({ level: "info" });

interface SummaryJobData {
  userId: string;
  cadence: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
}

export function startSummaryWorkers() {
  const config = { connection: redis, concurrency: env.CONCURRENCY };
  const defaultJobOptions = {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 5000 },
  };

  for (const queueName of ["summary.weekly.generate", "summary.monthly.generate"]) {
    const worker = new Worker<SummaryJobData>(
      queueName,
      async (job) => {
        const { userId, cadence, periodStart, periodEnd } = job.data;
        log.info({ jobId: job.id, userId, cadence }, "Starting summary generation");

        const { data: entries, error } = await supabase
          .from("journal_entries")
          .select("content, mood_tags, created_at")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .gte("created_at", `${periodStart}T00:00:00Z`)
          .lte("created_at", `${periodEnd}T23:59:59Z`);

        if (error) throw new Error(`DB error fetching entries: ${error.message}`);
        if (!entries?.length) {
          log.info({ jobId: job.id, userId }, "No entries for summary period — skipping");
          return;
        }

        const result = await generateSummary({
          entries: entries.map((e) => ({
            content: e["content"] as string,
            moodTags: (e["mood_tags"] as string[]) ?? [],
            createdAt: e["created_at"] as string,
          })),
          cadence,
          periodStart,
          periodEnd,
        });

        const moodTrend = entries.map((e) => ({
          date: (e["created_at"] as string).split("T")[0]!,
          dominantMood: ((e["mood_tags"] as string[]) ?? [])[0] ?? null,
        }));

        const { error: insertError } = await supabase.from("summaries").upsert({
          user_id: userId,
          cadence,
          period_start: periodStart,
          period_end: periodEnd,
          narrative_text: result.narrativeText,
          affirmation: result.affirmation,
          emotion_word_cloud: result.emotionWordCloud,
          mood_trend: moodTrend,
          highlights: result.highlights,
          entry_count: entries.length,
          generated_at: new Date().toISOString(),
        });

        if (insertError) throw new Error(`DB error saving summary: ${insertError.message}`);
        log.info({ jobId: job.id, userId }, "Summary generation complete");
      },
      config,
    );

    worker.on("failed", (job, err) => {
      log.error({ jobId: job?.id, err }, "Summary job failed");
    });
  }
}
