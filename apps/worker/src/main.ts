import pino from "pino";
import * as Sentry from "@sentry/node";
import { env } from "./lib/env.js";
import { startSummaryWorkers } from "./consumers/summary.js";
import { startTranscriptionWorker } from "./consumers/transcription.js";
import { startPartnerInsightWorker } from "./consumers/partnerInsight.js";
import { startMemoryBookWorker } from "./consumers/memoryBook.js";
import { startCommunityWorkers } from "./consumers/community.js";
import { startVideoPipelineWorker } from "./consumers/videoPipeline.js";
import { startFeedRankWorker } from "./consumers/feedRank.js";
import { startCommunityReportsWorker } from "./consumers/communityReports.js";

const log = pino({ level: "info" });

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

log.info("Starting Lumina Worker...");

startSummaryWorkers();
startTranscriptionWorker();
startPartnerInsightWorker();
startMemoryBookWorker();
startCommunityWorkers();
startVideoPipelineWorker();
startFeedRankWorker();
startCommunityReportsWorker();

log.info("All workers running.");

process.on("SIGTERM", () => {
  log.info("SIGTERM received — shutting down workers gracefully");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  log.error({ err }, "Uncaught exception");
  if (env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  process.exit(1);
});
