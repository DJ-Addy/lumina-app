import { z } from "zod";

export const NightFeedItemSchema = z.object({
  id: z.string().uuid(),
  snippet: z.string().min(1).max(280),
  timestampLabel: z.string(),
  reactionCount: z.number().int().min(0),
});
export type NightFeedItem = z.infer<typeof NightFeedItemSchema>;

export const NightFeedResponseSchema = z.object({
  items: z.array(NightFeedItemSchema),
  activeMomsCount: z.number().int().min(0),
  prompt: z.string(),
});
export type NightFeedResponse = z.infer<typeof NightFeedResponseSchema>;
