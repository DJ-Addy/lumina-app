import type { FastifyInstance } from "fastify";
import { TriggerSummaryRequestSchema } from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import { queues } from "../lib/queue.js";

export async function summaryRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/latest", async (request, reply) => {
    const { data, error } = await supabase
      .from("summaries")
      .select()
      .eq("user_id", request.user.id)
      .order("period_end", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "No summary yet" });
    }
    return reply.send({ summary: mapSummary(data) });
  });

  fastify.get("/", async (request, reply) => {
    const { data, error } = await supabase
      .from("summaries")
      .select()
      .eq("user_id", request.user.id)
      .order("period_end", { ascending: false })
      .limit(12);

    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to fetch summaries" });
    }
    return reply.send({ summaries: (data ?? []).map(mapSummary) });
  });

  fastify.post("/generate", async (request, reply) => {
    if (request.user.role !== "admin") {
      return reply.status(403).send({ code: "FORBIDDEN", message: "Admin only" });
    }

    const body = TriggerSummaryRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const queueName =
      body.data.cadence === "weekly" ? queues.summaryWeekly : queues.summaryMonthly;
    const job = await queueName.add("generate", {
      userId: request.user.id,
      cadence: body.data.cadence,
      periodStart: body.data.periodStart,
      periodEnd: body.data.periodEnd,
    });

    return reply.status(202).send({ jobId: job.id, status: "queued" });
  });
}

function mapSummary(row: Record<string, unknown>) {
  return {
    id: row["id"],
    userId: row["user_id"],
    cadence: row["cadence"],
    periodStart: row["period_start"],
    periodEnd: row["period_end"],
    narrativeText: row["narrative_text"],
    affirmation: row["affirmation"],
    emotionWordCloud: row["emotion_word_cloud"] ?? {},
    moodTrend: row["mood_trend"] ?? [],
    highlights: row["highlights"] ?? [],
    entryCount: row["entry_count"],
    generatedAt: row["generated_at"],
    createdAt: row["created_at"],
  };
}
