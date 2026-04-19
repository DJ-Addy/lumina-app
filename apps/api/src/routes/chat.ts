import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getProviderForTier } from "../lib/aiProvider.js";
import { checkAndConsumeCredit } from "../lib/subscription.js";
import { supabase } from "../lib/supabase.js";

const ChatRoleSchema = z.enum(["user", "assistant"]);

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: ChatRoleSchema,
        content: z.string().min(1).max(4000),
      }),
    )
    .max(40)
    .default([]),
  moodTags: z.array(z.string()).max(8).default([]),
  saveToJournal: z.boolean().default(false),
});

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/stream", async (request, reply) => {
    const parsed = ChatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ code: "VALIDATION_ERROR", message: parsed.error.message });
    }

    const { message, history, moodTags, saveToJournal } = parsed.data;
    const messageId = crypto.randomUUID();

    const credit = await checkAndConsumeCredit(request.user.id);
    if (!credit.allowed) {
      return reply.status(402).send({
        code: "CREDITS_EXHAUSTED",
        message: "You have reached your monthly limit.",
        tier: credit.tier,
      });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (event: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    send({ type: "start", messageId });

    let fullText = "";
    try {
      const provider = getProviderForTier(credit.tier);
      const generator = provider(
        history.map((h) => ({ role: h.role, content: h.content })),
        message,
        moodTags,
      );
      for await (const delta of generator) {
        fullText += delta;
        send({ type: "delta", text: delta });
      }
      send({ type: "done", fullText });
    } catch (err) {
      request.log.error({ err }, "Claude stream failed");
      send({
        type: "error",
        message: err instanceof Error ? err.message : "Stream failed",
      });
    } finally {
      reply.raw.end();
    }

    if (saveToJournal && fullText.length > 0) {
      try {
        await supabase.from("journal_entries").insert({
          user_id: request.user.id,
          mode: "text",
          content: `${message}\n\n— Lumina reflected:\n${fullText}`,
          mood_tags: moodTags,
          is_night_entry: false,
          week_number: 0,
          month_number: 0,
        });
      } catch (err) {
        request.log.error({ err }, "Failed to save chat to journal");
      }
    }
  });
}
