import type { FastifyInstance } from "fastify";
import {
  CreateJournalEntryRequestSchema,
  JournalQueryParamsSchema,
  UpdateJournalEntryRequestSchema,
  VoiceTranscribeRequestSchema,
} from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import { queues } from "../lib/queue.js";
import { moderateText } from "../lib/textModeration.js";

export async function journalRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/entries", async (request, reply) => {
    const body = CreateJournalEntryRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const babyBirthDate = await getUserBabyBirthDate(request.user.id);
    const { weekNumber, monthNumber } = getPostpartumWeekAndMonth(babyBirthDate);

    const mod = await moderateText(body.data.content);
    const crisisPayload =
      mod.severity === "crisis"
        ? { showResources: true as const, labels: mod.labels.map((l) => ({ label: l.label, score: l.score })) }
        : undefined;

    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        user_id: request.user.id,
        prompt_id: body.data.promptId ?? null,
        mode: body.data.mode,
        content: body.data.content,
        mood_tags: body.data.moodTags,
        is_night_entry: body.data.isNightEntry,
        week_number: weekNumber,
        month_number: monthNumber,
      })
      .select()
      .single();

    if (error) {
      request.log.error({ error }, "Failed to create journal entry");
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to create entry" });
    }

    return reply.status(201).send({
      entry: mapEntry(data),
      ...(crisisPayload !== undefined ? { crisis: crisisPayload } : {}),
    });
  });

  fastify.get("/entries", async (request, reply) => {
    const query = JournalQueryParamsSchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: query.error.message });
    }

    const { page, pageSize, weekNumber, monthNumber, isNightEntry, mode } = query.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = supabase
      .from("journal_entries")
      .select("*", { count: "exact" })
      .eq("user_id", request.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (weekNumber !== undefined) q = q.eq("week_number", weekNumber);
    if (monthNumber !== undefined) q = q.eq("month_number", monthNumber);
    if (isNightEntry !== undefined) q = q.eq("is_night_entry", isNightEntry);
    if (mode !== undefined) q = q.eq("mode", mode);

    const { data, error, count } = await q;
    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to fetch entries" });
    }

    return reply.send({
      entries: (data ?? []).map(mapEntry),
      total: count ?? 0,
      page,
      pageSize,
    });
  });

  fastify.get<{ Params: { id: string } }>("/entries/:id", async (request, reply) => {
    const { data, error } = await supabase
      .from("journal_entries")
      .select()
      .eq("id", request.params.id)
      .eq("user_id", request.user.id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Entry not found" });
    }
    return reply.send({ entry: mapEntry(data) });
  });

  fastify.patch<{ Params: { id: string } }>("/entries/:id", async (request, reply) => {
    const body = UpdateJournalEntryRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.data.content !== undefined) updates["content"] = body.data.content;
    if (body.data.moodTags !== undefined) updates["mood_tags"] = body.data.moodTags;

    let crisisPayload: { showResources: true; labels: { label: string; score: number }[] } | undefined;
    if (body.data.content !== undefined) {
      const mod = await moderateText(body.data.content);
      if (mod.severity === "crisis") {
        crisisPayload = {
          showResources: true,
          labels: mod.labels.map((l) => ({ label: l.label, score: l.score })),
        };
      }
    }

    const { data, error } = await supabase
      .from("journal_entries")
      .update(updates)
      .eq("id", request.params.id)
      .eq("user_id", request.user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Entry not found" });
    }
    return reply.send({
      entry: mapEntry(data),
      ...(crisisPayload !== undefined ? { crisis: crisisPayload } : {}),
    });
  });

  fastify.delete<{ Params: { id: string } }>("/entries/:id", async (request, reply) => {
    const { error } = await supabase
      .from("journal_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .eq("user_id", request.user.id);

    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to delete entry" });
    }
    return reply.status(204).send();
  });

  fastify.post("/voice/transcribe", async (request, reply) => {
    const body = VoiceTranscribeRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const job = await queues.voiceTranscribe.add("transcribe", {
      userId: request.user.id,
      audioFileKey: body.data.audioFileKey,
      promptId: body.data.promptId ?? null,
      moodTags: body.data.moodTags,
      isNightEntry: body.data.isNightEntry,
    });

    return reply.status(202).send({
      jobId: job.id,
      status: "queued",
      entryId: null,
    });
  });
}

function mapEntry(row: Record<string, unknown>) {
  return {
    id: row["id"],
    userId: row["user_id"],
    promptId: row["prompt_id"],
    mode: row["mode"],
    content: row["content"],
    audioFileKey: row["audio_file_key"],
    moodTags: row["mood_tags"] ?? [],
    isNightEntry: row["is_night_entry"],
    isSharedToCommunity: row["is_shared_to_community"],
    communityPostId: row["community_post_id"],
    weekNumber: row["week_number"],
    monthNumber: row["month_number"],
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
    deletedAt: row["deleted_at"],
  };
}

async function getUserBabyBirthDate(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("baby_birth_date")
    .eq("id", userId)
    .single();
  return (data?.["baby_birth_date"] as string | null) ?? null;
}

function getPostpartumWeekAndMonth(babyBirthDate: string | null): {
  weekNumber: number;
  monthNumber: number;
} {
  if (!babyBirthDate) return { weekNumber: 0, monthNumber: 0 };
  const birth = new Date(babyBirthDate);
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return {
    weekNumber: Math.min(Math.floor(diffDays / 7), 52),
    monthNumber: Math.min(Math.floor(diffDays / 30), 12),
  };
}
