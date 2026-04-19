import pino from "pino";
import { startSummaryWorkers } from "./consumers/summary.js";
import { startTranscriptionWorker } from "./consumers/transcription.js";
import { startPartnerInsightWorker } from "./consumers/partnerInsight.js";
import { startMemoryBookWorker } from "./consumers/memoryBook.js";
import { startCommunityWorkers } from "./consumers/community.js";
import { startVideoPipelineWorker } from "./consumers/videoPipeline.js";
import { startFeedRankWorker } from "./consumers/feedRank.js";
import { startCommunityReportsWorker } from "./consumers/communityReports.js";

const log = pino({ level: "info" });

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
  process.exit(1);
});
