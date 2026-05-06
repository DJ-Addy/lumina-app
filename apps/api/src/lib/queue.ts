import { Queue } from "bullmq";
import { getRedis } from "./redis.js";

const connection = getRedis();

const retry2 = { attempts: 2, backoff: { type: "exponential" as const, delay: 10_000 } };
const retry3 = { attempts: 3, backoff: { type: "exponential" as const, delay: 3000 } };

export const queues = {
  summaryWeekly: new Queue("summary.weekly.generate", { connection }),
  summaryMonthly: new Queue("summary.monthly.generate", { connection }),
  memoryBook: new Queue("memorybook.export", { connection, defaultJobOptions: retry2 }),
  voiceTranscribe: new Queue("voice.transcribe", { connection, defaultJobOptions: retry2 }),
  partnerInsight: new Queue("partnerinsight.generate", { connection, defaultJobOptions: retry3 }),
  communityModeration: new Queue("community.moderation.scan", { connection }),
  communityFeedRank: new Queue("community.feed.rank", { connection }),
  videoProcess: new Queue("video.process", { connection }),
  communityReports: new Queue("community.reports.review", { connection }),
};

export type QueueName = keyof typeof queues;
