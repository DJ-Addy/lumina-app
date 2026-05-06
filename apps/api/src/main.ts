import Fastify from "fastify";
import * as Sentry from "@sentry/node";
import { env } from "./lib/env.js";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}
import authPlugin from "./plugins/auth.js";
import corsPlugin from "./plugins/cors.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import { journalRoutes } from "./routes/journal.js";
import { promptRoutes } from "./routes/prompts.js";
import { timelineRoutes } from "./routes/timeline.js";
import { nightRoutes } from "./routes/night.js";
import { summaryRoutes } from "./routes/summaries.js";
import { partnerInsightRoutes } from "./routes/partnerInsights.js";
import { memoryBookRoutes } from "./routes/memoryBook.js";
import { communityRoutes } from "./routes/community.js";
import { communityMediaRoutes } from "./routes/communityMedia.js";
import { communityReelsRoutes } from "./routes/communityReels.js";
import { moderationRoutes } from "./routes/moderation.js";
import { astrologyRoutes } from "./routes/astrology.js";
import { profileRoutes } from "./routes/profile.js";
import { chatRoutes } from "./routes/chat.js";
import { webhookRoutes } from "./routes/webhooks.js";

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    ...(env.NODE_ENV !== "production"
      ? { transport: { target: "pino-pretty", options: { colorize: true } } }
      : {}),
  },
  genReqId: () => crypto.randomUUID(),
  requestIdHeader: "x-request-id",
});

fastify.addHook("onSend", (_req, reply, _payload, done) => {
  reply.header("X-Request-ID", _req.id);
  done();
});

await fastify.register(corsPlugin);
await fastify.register(authPlugin);
await fastify.register(rateLimitPlugin);

await fastify.register(profileRoutes, { prefix: "/v1/profile" });
await fastify.register(journalRoutes, { prefix: "/v1/journal" });
await fastify.register(promptRoutes, { prefix: "/v1/prompts" });
await fastify.register(timelineRoutes, { prefix: "/v1/timeline" });
await fastify.register(nightRoutes, { prefix: "/v1/night" });
await fastify.register(summaryRoutes, { prefix: "/v1/summaries" });
await fastify.register(partnerInsightRoutes, { prefix: "/v1/partner-insights" });
await fastify.register(memoryBookRoutes, { prefix: "/v1/memory-book" });
await fastify.register(communityRoutes, { prefix: "/v1/community" });
await fastify.register(communityMediaRoutes, { prefix: "/v1/community/media" });
await fastify.register(communityReelsRoutes, { prefix: "/v1/community/reels" });
await fastify.register(moderationRoutes, { prefix: "/v1/moderation" });
await fastify.register(astrologyRoutes, { prefix: "/v1/astrology" });
await fastify.register(chatRoutes, { prefix: "/v1/chat" });
await fastify.register(webhookRoutes, { prefix: "/v1/webhooks" });

fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

interface ErrorWithCode {
  statusCode?: number;
  code?: string;
  message?: string;
}

fastify.setErrorHandler((error, request, reply) => {
  const e = error as ErrorWithCode;
  request.log.error({ error: e }, "Unhandled error");
  if (env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  const status = e.statusCode ?? 500;
  const code = e.code ?? "INTERNAL_ERROR";
  const message =
    env.NODE_ENV === "production"
      ? "Internal server error"
      : e.message ?? "Unknown error";
  return reply.status(status).send({
    code,
    message,
    requestId: request.id,
  });
});

try {
  await fastify.listen({ port: env.PORT, host: env.HOST });
  fastify.log.info(`Lumina API running on ${env.HOST}:${env.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
