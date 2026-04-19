import { z } from "zod";
import { JournalEntrySchema } from "./journal";

export const TimelineCheckpointSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  weekNumber: z.number().int().nullable(),
  monthNumber: z.number().int().nullable(),
  label: z.string(),
  description: z.string(),
  reachedAt: z.string().datetime().nullable(),
});
export type TimelineCheckpoint = z.infer<typeof TimelineCheckpointSchema>;

export const TimelineWeekGroupSchema = z.object({
  weekNumber: z.number().int(),
  label: z.string(),
  entries: z.array(JournalEntrySchema),
  checkpoint: TimelineCheckpointSchema.nullable(),
  entryCount: z.number().int(),
});
export type TimelineWeekGroup = z.infer<typeof TimelineWeekGroupSchema>;

export const TimelineResponseSchema = z.object({
  groups: z.array(TimelineWeekGroupSchema),
  totalEntries: z.number().int(),
  currentWeek: z.number().int(),
  currentMonth: z.number().int(),
});
export type TimelineResponse = z.infer<typeof TimelineResponseSchema>;
