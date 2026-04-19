import { z } from "zod";

export const MemoryBookExportStatusSchema = z.enum([
  "pending",
  "generating",
  "ready",
  "failed",
]);
export type MemoryBookExportStatus = z.infer<typeof MemoryBookExportStatusSchema>;

export const MemoryBookExportSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: MemoryBookExportStatusSchema,
  monthCheckpoint: z.number().int().min(1).max(12),
  coverVariant: z.string(),
  downloadUrl: z.string().url().nullable(),
  downloadExpiresAt: z.string().datetime().nullable(),
  requestedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
});
export type MemoryBookExport = z.infer<typeof MemoryBookExportSchema>;

export const RequestMemoryBookExportSchema = z.object({
  monthCheckpoint: z.number().int().min(1).max(12),
  coverVariant: z.string().optional().default("default"),
  includeLetters: z.boolean().optional().default(true),
  includeEntries: z.boolean().optional().default(true),
});
export type RequestMemoryBookExport = z.infer<typeof RequestMemoryBookExportSchema>;

export const MemoryBookExportResponseSchema = z.object({
  export: MemoryBookExportSchema,
  jobId: z.string(),
});
export type MemoryBookExportResponse = z.infer<typeof MemoryBookExportResponseSchema>;
