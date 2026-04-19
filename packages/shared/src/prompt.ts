import { z } from "zod";
import { PromptCategory } from \"./enums\";

export const PromptSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(500),
  category: z.nativeEnum(PromptCategory),
  weekMin: z.number().int().min(0).nullable(),
  weekMax: z.number().int().max(52).nullable(),
  isMoonPhase: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type Prompt = z.infer<typeof PromptSchema>;

export const TodayPromptResponseSchema = z.object({
  prompt: PromptSchema,
  cosmicContext: z.string().nullable(),
  moonPhase: z.string().nullable(),
});
export type TodayPromptResponse = z.infer<typeof TodayPromptResponseSchema>;
