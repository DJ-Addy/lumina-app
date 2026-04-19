import type { FastifyInstance } from "fastify";
import { GeneratePartnerInsightRequestSchema } from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import { queues } from "../lib/queue.js";

export async function partnerInsightRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/generate", async (request, reply) => {
    const body = GeneratePartnerInsightRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const existing = await supabase
      .from("partner_insights")
      .select()
      .eq("user_id", request.user.id)
      .eq("week_start", body.data.weekStart)
      .single();

    if (existing.data) {
      return reply.send({ insight: mapInsight(existing.data), jobId: null, status: "ready" });
    }

    const job = await queues.partnerInsight.add("generate", {
      userId: request.user.id,
      weekStart: body.data.weekStart,
      weekEnd: body.data.weekEnd,
    });

    return reply.status(202).send({ insight: null, jobId: job.id, status: "generating" });
  });

  fastify.get("/latest", async (request, reply) => {
    const { data, error } = await supabase
      .from("partner_insights")
      .select()
      .eq("user_id", request.user.id)
      .order("week_start", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "No partner insight yet" });
    }
    return reply.send({ insight: mapInsight(data), jobId: null, status: "ready" });
  });
}

function mapInsight(row: Record<string, unknown>) {
  return {
    id: row["id"],
    userId: row["user_id"],
    weekStart: row["week_start"],
    weekEnd: row["week_end"],
    cardText: row["card_text"],
    needsList: row["needs_list"] ?? [],
    shareableImageKey: row["shareable_image_key"],
    generatedAt: row["generated_at"],
    createdAt: row["created_at"],
  };
}
