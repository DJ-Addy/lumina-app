import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import { getRedis } from "../lib/redis.js";

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    redis: getRedis(),
    keyGenerator: (request) => request.user?.id ?? request.ip,
    errorResponseBuilder: (_request, context) => ({
      code: "RATE_LIMITED",
      message: `Too many requests. Please wait ${context.after}.`,
    }),
  });
}

export default fp(rateLimitPlugin, { name: "rateLimit" });
