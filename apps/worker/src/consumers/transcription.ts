import { Worker } from "bullmq";
import { createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import pino from "pino";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { transcribeAudio } from "../providers/whisper.js";
import { env } from "../lib/env.js";

const log = pino({ level: "info" });

interface TranscribeJobData {
  userId: string;
  audioFileKey: string;
  promptId: string | null;
  moodTags: string[];
  isNightEntry: boolean;
}

export function startTranscriptionWorker() {
  const worker = new Worker<TranscribeJobData>(
    "voice.transcribe",
    async (job) => {
      const { userId, audioFileKey, promptId, moodTags, isNightEntry } = job.data;
      log.info({ jobId: job.id, userId }, "Starting transcription");

      const { data: signedUrl, error: urlError } = await supabase.storage
        .from("voice-notes")
        .createSignedUrl(audioFileKey, 300);

      if (urlError || !signedUrl) {
        throw new Error(`Failed to get signed URL: ${urlError?.message}`);
      }

      const localPath = join(tmpdir(), `voice-${job.id}.webm`);
      await downloadFile(signedUrl.signedUrl, localPath);

      let transcript: string;
      try {
        transcript = await transcribeAudio(localPath);
      } finally {
        await unlink(localPath).catch(() => undefined);
        await supabase.storage.from("voice-notes").remove([audioFileKey]);
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("baby_birth_date")
        .eq("id", userId)
        .single();

      const babyBirthDate = profile?.["baby_birth_date"] as string | null;
      const { weekNumber, monthNumber } = getPostpartumProgress(babyBirthDate);

      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert({
          user_id: userId,
          prompt_id: promptId,
          mode: "voice",
          content: transcript,
          audio_file_key: null,
          mood_tags: moodTags,
          is_night_entry: isNightEntry,
          week_number: weekNumber,
          month_number: monthNumber,
        })
        .select()
        .single();

      if (entryError) throw new Error(`DB error creating entry: ${entryError.message}`);

      await supabase.from("voice_job_status").upsert({
        job_id: job.id,
        user_id: userId,
        status: "done",
        entry_id: entry?.["id"] ?? null,
      });

      log.info({ jobId: job.id, userId }, "Transcription complete");
    },
    { connection: redis, concurrency: env.CONCURRENCY, attempts: 2 },
  );

  worker.on("failed", async (job, err) => {
    log.error({ jobId: job?.id, err }, "Transcription job failed");
    if (job) {
      await supabase.from("voice_job_status").upsert({
        job_id: job.id,
        user_id: job.data.userId,
        status: "failed",
        entry_id: null,
      });
      await supabase.storage.from("voice-notes").remove([job.data.audioFileKey]).catch(() => undefined);
    }
  });
}

async function downloadFile(url: string, localPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download audio: ${res.statusText}`);
  const writeStream = createWriteStream(localPath);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const pump = async () => {
    const { done, value } = await reader.read();
    if (done) {
      writeStream.end();
      return;
    }
    writeStream.write(value);
    await pump();
  };

  await pump();
  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
}

function getPostpartumProgress(babyBirthDate: string | null) {
  if (!babyBirthDate) return { weekNumber: 0, monthNumber: 0 };
  const birth = new Date(babyBirthDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  return {
    weekNumber: Math.min(Math.floor(diffDays / 7), 52),
    monthNumber: Math.min(Math.floor(diffDays / 30), 12),
  };
}
