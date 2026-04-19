import { z } from "zod";
import { JournalEntryMode, MoodTag } from \"./enums\";

export const JournalEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  promptId: z.string().uuid().nullable(),
  mode: z.nativeEnum(JournalEntryMode),
  content: z.string().min(1).max(10000),
  audioFileKey: z.string().nullable(),
  moodTags: z.array(z.nativeEnum(MoodTag)).max(5),
  isNightEntry: z.boolean().default(false),
  isSharedToCommunity: z.boolean().default(false),
  communityPostId: z.string().uuid().nullable(),
  weekNumber: z.number().int().min(0).max(52),
  monthNumber: z.number().int().min(0).max(12),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const CreateJournalEntryRequestSchema = z.object({
  promptId: z.string().uuid().nullable().optional(),
  mode: z.nativeEnum(JournalEntryMode),
  content: z.string().min(1).max(10000),
  moodTags: z.array(z.nativeEnum(MoodTag)).max(5).optional().default([]),
  isNightEntry: z.boolean().optional().default(false),
});
export type CreateJournalEntryRequest = z.infer<typeof CreateJournalEntryRequestSchema>;

export const UpdateJournalEntryRequestSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  moodTags: z.array(z.nativeEnum(MoodTag)).max(5).optional(),
});
export type UpdateJournalEntryRequest = z.infer<typeof UpdateJournalEntryRequestSchema>;

export const JournalEntriesResponseSchema = z.object({
  entries: z.array(JournalEntrySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type JournalEntriesResponse = z.infer<typeof JournalEntriesResponseSchema>;

export const JournalQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  weekNumber: z.coerce.number().int().optional(),
  monthNumber: z.coerce.number().int().optional(),
  isNightEntry: z.coerce.boolean().optional(),
  mode: z.nativeEnum(JournalEntryMode).optional(),
});
export type JournalQueryParams = z.infer<typeof JournalQueryParamsSchema>;

export const VoiceTranscribeRequestSchema = z.object({
  audioFileKey: z.string().min(1),
  promptId: z.string().uuid().nullable().optional(),
  moodTags: z.array(z.nativeEnum(MoodTag)).max(5).optional().default([]),
  isNightEntry: z.boolean().optional().default(false),
});
export type VoiceTranscribeRequest = z.infer<typeof VoiceTranscribeRequestSchema>;

export const VoiceTranscribeResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(["queued", "processing", "done", "failed"]),
  entryId: z.string().uuid().nullable(),
});
export type VoiceTranscribeResponse = z.infer<typeof VoiceTranscribeResponseSchema>;
