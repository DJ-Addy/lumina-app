import type { FastifyInstance } from "fastify";
import { RequestMemoryBookExportSchema } from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import { queues } from "../lib/queue.js";

export async function memoryBookRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/export", async (request, reply) => {
    const body = RequestMemoryBookExportSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("subscription_tier")
      .eq("id", request.user.id)
      .single();

    if (profile?.["subscription_tier"] !== "pro") {
      return reply.status(402).send({
        code: "PRO_REQUIRED",
        message: "Memory Book export requires a Lumina Pro subscription",
      });
    }

    const { data: exportRecord, error } = await supabase
      .from("memory_book_exports")
      .insert({
        user_id: request.user.id,
        status: "pending",
        month_checkpoint: body.data.monthCheckpoint,
        cover_variant: body.data.coverVariant,
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !exportRecord) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to create export" });
    }

    const job = await queues.memoryBook.add("export", {
      userId: request.user.id,
      exportId: exportRecord["id"],
      monthCheckpoint: body.data.monthCheckpoint,
      coverVariant: body.data.coverVariant,
      includeLetters: body.data.includeLetters,
      includeEntries: body.data.includeEntries,
    });

    return reply.status(202).send({
      export: mapExport(exportRecord),
      jobId: job.id,
    });
  });

  fastify.get<{ Params: { id: string } }>("/export/:id", async (request, reply) => {
    const { data, error } = await supabase
      .from("memory_book_exports")
      .select()
      .eq("id", request.params.id)
      .eq("user_id", request.user.id)
      .single();

    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Export not found" });
    }
    return reply.send({ export: mapExport(data) });
  });
}

function mapExport(row: Record<string, unknown>) {
  return {
    id: row["id"],
    userId: row["user_id"],
    status: row["status"],
    monthCheckpoint: row["month_checkpoint"],
    coverVariant: row["cover_variant"],
    downloadUrl: row["download_url"],
    downloadExpiresAt: row["download_expires_at"],
    requestedAt: row["requested_at"],
    completedAt: row["completed_at"],
    errorMessage: row["error_message"],
  };
}
