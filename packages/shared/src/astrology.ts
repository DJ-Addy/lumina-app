import { z } from "zod";

export const AstrologyProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  birthDate: z.string().date(),
  birthTime: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  sunSign: z.string(),
  moonSign: z.string().nullable(),
  risingSign: z.string().nullable(),
  babyBirthDate: z.string().date().optional().nullable(),
  babySunSign: z.string().nullable(),
});
export type AstrologyProfile = z.infer<typeof AstrologyProfileSchema>;

export const CreateAstrologyProfileRequestSchema = z.object({
  birthDate: z.string().date(),
  birthTime: z.string().optional(),
  birthPlace: z.string().optional(),
  babyBirthDate: z.string().date().optional(),
});
export type CreateAstrologyProfileRequest = z.infer<typeof CreateAstrologyProfileRequestSchema>;

export const CosmicCardSchema = z.object({
  moonPhase: z.string(),
  moonSign: z.string(),
  dailyContext: z.string(),
  weeklyForecast: z.string().nullable(),
  momBabyInsight: z.string().nullable(),
  journalPromptSuggestion: z.string().nullable(),
  date: z.string().date(),
});
export type CosmicCard = z.infer<typeof CosmicCardSchema>;
