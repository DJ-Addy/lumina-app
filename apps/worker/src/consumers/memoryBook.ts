import { Worker } from "bullmq";
import { unlink } from "fs/promises";
import { readFile } from "fs/promises";
import pino from "pino";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { generateMemoryBookPdf } from "../providers/pdf.js";
import { env } from "../lib/env.js";

const log = pino({ level: "info" });

interface MemoryBookJobData {
  userId: string;
  exportId: string;
  monthCheckpoint: number;
  coverVariant: string;
  includeLetters: boolean;
  includeEntries: boolean;
}

export function startMemoryBookWorker() {
  const worker = new Worker<MemoryBookJobData>(
    "memorybook.export",
    async (job) => {
      const { userId, exportId, monthCheckpoint, coverVariant, includeLetters, includeEntries } =
        job.data;
      log.info({ jobId: job.id, userId, exportId }, "Starting memory book PDF generation");

      await supabase
        .from("memory_book_exports")
        .update({ status: "generating" })
        .eq("id", exportId);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("baby_name")
        .eq("id", userId)
        .single();

      const babyName = (profile?.["baby_name"] as string | null) ?? "Little One";

      const entries = includeEntries
        ? await supabase
            .from("journal_entries")
            .select("content, created_at, week_number, mood_tags")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .lte("month_number", monthCheckpoint)
            .order("created_at")
            .then((r) => r.data ?? [])
        : [];

      const letters = includeLetters
        ? await supabase
            .from("journal_entries")
            .select("content, created_at")
            .eq("user_id", userId)
            .eq("mode", "letter")
            .is("deleted_at", null)
            .order("created_at")
            .then((r) => r.data ?? [])
        : [];

      const localPath = await generateMemoryBookPdf({
        babyName,
        monthCheckpoint,
        coverVariant,
        entries: entries.map((e) => ({
          content: e["content"] as string,
          createdAt: e["created_at"] as string,
          weekNumber: (e["week_number"] as number) ?? 0,
          moodTags: (e["mood_tags"] as string[]) ?? [],
        })),
        letters: letters.map((l) => ({
          content: l["content"] as string,
          createdAt: l["created_at"] as string,
        })),
      });

      const fileBuffer = await readFile(localPath);
      const storageKey = `memory-books/${userId}/${exportId}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("memory-books")
        .upload(storageKey, fileBuffer, { contentType: "application/pdf", upsert: true });

      await unlink(localPath).catch(() => undefined);

      if (uploadError) {
        await supabase
          .from("memory_book_exports")
          .update({ status: "failed", error_message: uploadError.message })
          .eq("id", exportId);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: signedUrl } = await supabase.storage
        .from("memory-books")
        .createSignedUrl(storageKey, 60 * 60 * 48);

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      await supabase
        .from("memory_book_exports")
        .update({
          status: "ready",
          download_url: signedUrl?.signedUrl ?? null,
          download_expires_at: expiresAt,
          completed_at: new Date().toISOString(),
        })
        .eq("id", exportId);

      log.info({ jobId: job.id, userId, exportId }, "Memory book export complete");
    },
    {
      connection: redis,
      concurrency: 2,
      defaultJobOptions: { attempts: 2, backoff: { type: "exponential", delay: 10000 } },
    },
  );

  worker.on("failed", async (job, err) => {
    log.error({ jobId: job?.id, err }, "Memory book job failed");
    if (job) {
      await supabase
        .from("memory_book_exports")
        .update({ status: "failed", error_message: err.message })
        .eq("id", job.data.exportId)
        .catch(() => undefined);
    }
  });
}
