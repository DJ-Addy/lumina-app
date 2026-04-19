import { Queue } from "bullmq";
import { getRedis } from "./redis.js";

const connection = getRedis();

export const queues = {
  summaryWeekly: new Queue("summary.weekly.generate", { connection }),
  summaryMonthly: new Queue("summary.monthly.generate", { connection }),
  memoryBook: new Queue("memorybook.export", { connection }),
  voiceTranscribe: new Queue("voice.transcribe", { connection }),
  partnerInsight: new Queue("partnerinsight.generate", { connection }),
  communityModeration: new Queue("community.moderation.scan", { connection }),
  communityFeedRank: new Queue("community.feed.rank", { connection }),
};

export type QueueName = keyof typeof queues;
