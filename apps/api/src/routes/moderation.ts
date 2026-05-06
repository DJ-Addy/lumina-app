import type { FastifyInstance } from "fastify";
import { ModerateTextRequestSchema } from "@lumina/shared";
import { moderateText } from "../lib/textModeration.js";

export async function moderationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /**
   * POST /v1/moderation/text
   * Proxy for OpenAI's free Moderation API. The mobile client doesn't have
   * a key, so we run the check server-side and return the labels + severity.
   */
  fastify.post("/text", async (request, reply) => {
    const parsed = ModerateTextRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: parsed.error.message });
    }
    const result = await moderateText(parsed.data.text);
    return reply.send(result);
  });
}
