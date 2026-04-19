import { z } from "zod";
import { SummaryCadence, MoodTag } from "./enums";

export const SummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  cadence: z.nativeEnum(SummaryCadence),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  narrativeText: z.string(),
  affirmation: z.string(),
  emotionWordCloud: z.record(z.string(), z.number()),
  moodTrend: z.array(
    z.object({
      date: z.string().date(),
      dominantMood: z.nativeEnum(MoodTag).nullable(),
    }),
  ),
  highlights: z.array(z.string()).max(5),
  entryCount: z.number().int(),
  generatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type Summary = z.infer<typeof SummarySchema>;

export const SummaryResponseSchema = z.object({
  summary: SummarySchema,
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

export const TriggerSummaryRequestSchema = z.object({
  cadence: z.nativeEnum(SummaryCadence),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
});
export type TriggerSummaryRequest = z.infer<typeof TriggerSummaryRequestSchema>;
