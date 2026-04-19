import type { FastifyInstance } from "fastify";
import { UpdateProfileRequestSchema } from "@lumina/shared";
import { supabase } from "../lib/supabase.js";

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/me", async (request, reply) => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select()
      .eq("id", request.user.id)
      .single();

    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Profile not found" });
    }
    return reply.send({ profile: mapProfile(data) });
  });

  fastify.get("/me/credits", async (request, reply) => {
    const { getCreditStatus } = await import("../lib/subscription.js");
    const status = await getCreditStatus(request.user.id);
    return reply.send(status);
  });

  fastify.patch("/me", async (request, reply) => {
    const body = UpdateProfileRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.data.displayName !== undefined) updates["display_name"] = body.data.displayName;
    if (body.data.babyName !== undefined) updates["baby_name"] = body.data.babyName;
    if (body.data.babyDueDate !== undefined) updates["baby_due_date"] = body.data.babyDueDate;
    if (body.data.babyBirthDate !== undefined) updates["baby_birth_date"] = body.data.babyBirthDate;

    const { data, error } = await supabase
      .from("user_profiles")
      .upsert({ id: request.user.id, ...updates })
      .select()
      .single();

    if (error || !data) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to update profile" });
    }
    return reply.send({ profile: mapProfile(data) });
  });

  fastify.delete("/me", async (request, reply) => {
    await supabase
      .from("journal_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", request.user.id);

    await supabase.from("user_profiles").delete().eq("id", request.user.id);
    await supabase.auth.admin.deleteUser(request.user.id);

    return reply.status(204).send();
  });

  fastify.get("/me/export", async (request, reply) => {
    const [profileRes, entriesRes, summariesRes] = await Promise.all([
      supabase.from("user_profiles").select().eq("id", request.user.id).single(),
      supabase
        .from("journal_entries")
        .select()
        .eq("user_id", request.user.id)
        .is("deleted_at", null)
        .order("created_at"),
      supabase.from("summaries").select().eq("user_id", request.user.id).order("period_end"),
    ]);

    return reply.send({
      exportedAt: new Date().toISOString(),
      profile: profileRes.data ? mapProfile(profileRes.data) : null,
      journalEntries: entriesRes.data ?? [],
      summaries: summariesRes.data ?? [],
    });
  });
}

function mapProfile(row: Record<string, unknown>) {
  return {
    id: row["id"],
    email: row["email"],
    displayName: row["display_name"],
    babyName: row["baby_name"],
    babyDueDate: row["baby_due_date"],
    babyBirthDate: row["baby_birth_date"],
    subscriptionTier: row["subscription_tier"] ?? "free",
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}
