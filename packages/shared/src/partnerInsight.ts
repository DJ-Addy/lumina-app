import { z } from "zod";

export const PartnerInsightSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  weekStart: z.string().date(),
  weekEnd: z.string().date(),
  cardText: z.string(),
  needsList: z.array(z.string()).max(5),
  shareableImageKey: z.string().nullable(),
  generatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type PartnerInsight = z.infer<typeof PartnerInsightSchema>;

export const GeneratePartnerInsightRequestSchema = z.object({
  weekStart: z.string().date(),
  weekEnd: z.string().date(),
});
export type GeneratePartnerInsightRequest = z.infer<typeof GeneratePartnerInsightRequestSchema>;

export const PartnerInsightResponseSchema = z.object({
  insight: PartnerInsightSchema,
  jobId: z.string().nullable(),
  status: z.enum(["ready", "generating"]),
});
export type PartnerInsightResponse = z.infer<typeof PartnerInsightResponseSchema>;
