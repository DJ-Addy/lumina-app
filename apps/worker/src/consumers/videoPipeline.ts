import { Worker } from "bullmq";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { env } from "../lib/env.js";
import { classifyFrames, classifyImage } from "../lib/imageModeration.js";
import { sendTOSViolationEmail } from "../lib/email.js";

ffmpeg.setFfmpegPath((ffmpegPath as unknown as { path: string }).path);
ffmpeg.setFfprobePath((ffprobePath as unknown as { path: string }).path);

const log = pino({ level: "info" });
const COMMUNITY_BUCKET = "community-media";
const FRAME_SAMPLE_COUNT = 6;

interface VideoJob {
  mediaId: string;
  userId: string;
  storageKey: string;
  kind?: "video" | "image";
}

const VARIANT_SPECS = [
  { label: "480p" as const, height: 480, bitrateKbps: 800 },
  { label: "720p" as const, height: 720, bitrateKbps: 1800 },
];

export function startVideoPipelineWorker() {
  const worker = new Worker<VideoJob>(
    "video.process",
    async (job) => {
      const { mediaId, userId, storageKey, kind } = job.data;
      log.info({ mediaId, kind }, "Media pipeline starting");

      const workDir = await mkdtemp(join(tmpdir(), `media-${mediaId}-`));
      const sourcePath = join(workDir, "source");

      try {
        await supabase.from("community_media").update({ status: "processing" }).eq("id", mediaId);

        const { data: blob, error: dlErr } = await supabase.storage
          .from(COMMUNITY_BUCKET)
          .download(storageKey);
        if (dlErr || !blob) throw new Error(`Source download failed: ${dlErr?.message}`);
        await writeFile(sourcePath, Buffer.from(await blob.arrayBuffer()));

        // Branch: image-only moderation skips the rest of the pipeline.
        if (kind === "image") {
          const result = await classifyImage(sourcePath);
          await persistModerationResult(mediaId, result);

          if (result.severity === "block") {
            await rejectMedia(mediaId, userId, storageKey, result.reason ?? "Image moderation");
            return;
          }
          await supabase
            .from("community_media")
            .update({ status: "ready", updated_at: new Date().toISOString() })
            .eq("id", mediaId);
          return;
        }

        // VIDEO PATH
        const meta = await probeVideo(sourcePath);
        log.info({ mediaId, meta }, "Probed source");

        // 1. Sample frames at evenly-spaced timestamps and run NSFW classifier
        const sampleDir = join(workDir, "samples");
        const framePaths = await sampleFrames(sourcePath, sampleDir, meta.durationMs ?? 0);
        const modResult = await classifyFrames(framePaths);
        await persistModerationResult(mediaId, modResult);
        log.info(
          { mediaId, score: modResult.score, perFrame: modResult.perFrameScores },
          "Frame moderation complete",
        );

        if (modResult.severity === "block") {
          await rejectMedia(
            mediaId,
            userId,
            storageKey,
            modResult.reason ?? "Video moderation",
          );
          return;
        }

        // 2. Generate thumbnail
        const thumbPath = join(workDir, "thumb.jpg");
        await extractThumbnail(sourcePath, thumbPath);
        const thumbKey = `${userId}/${mediaId}/thumb.jpg`;
        await uploadObject(thumbKey, await readFile(thumbPath), "image/jpeg");

        // 3. Transcode each variant
        const variants: Array<{ key: string; label: "480p" | "720p"; bitrateKbps: number; codec: string }> = [];
        for (const spec of VARIANT_SPECS) {
          if (meta.height && meta.height < spec.height) continue;
          const variantPath = join(workDir, `${spec.label}.mp4`);
          await transcode(sourcePath, variantPath, spec);
          const variantKey = `${userId}/${mediaId}/${spec.label}.mp4`;
          await uploadObject(variantKey, await readFile(variantPath), "video/mp4");
          variants.push({ key: variantKey, label: spec.label, bitrateKbps: spec.bitrateKbps, codec: "h264" });
        }

        if (!variants.length) {
          const variantKey = `${userId}/${mediaId}/source.mp4`;
          await uploadObject(variantKey, await readFile(sourcePath), "video/mp4");
          variants.push({ key: variantKey, label: "480p", bitrateKbps: 800, codec: "h264" });
        }

        await supabase
          .from("community_media")
          .update({
            status: "ready",
            thumbnail_key: thumbKey,
            duration_ms: meta.durationMs ?? null,
            width: meta.width ?? null,
            height: meta.height ?? null,
            variants,
            updated_at: new Date().toISOString(),
          })
          .eq("id", mediaId);

        await redis.del("reels:feed:v1");

        log.info({ mediaId, variants: variants.length }, "Video pipeline complete");
      } catch (err) {
        log.error({ mediaId, err }, "Media pipeline failed");
        await supabase
          .from("community_media")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", mediaId);
        throw err;
      } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
      }
    },
    { connection: redis, concurrency: Math.max(1, Math.min(env.CONCURRENCY, 3)) },
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Media pipeline job failed");
  });
}

interface ProbeResult {
  width?: number;
  height?: number;
  durationMs?: number;
}

function probeVideo(path: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) return reject(err);
      const stream = data.streams.find((s) => s.codec_type === "video");
      const result: ProbeResult = {};
      if (stream?.width !== undefined) result.width = stream.width;
      if (stream?.height !== undefined) result.height = stream.height;
      if (data.format?.duration !== undefined) {
        result.durationMs = Math.round(data.format.duration * 1000);
      }
      resolve(result);
    });
  });
}

function extractThumbnail(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(src)
      .on("end", () => resolve())
      .on("error", reject)
      .screenshots({
        timestamps: ["1"],
        filename: dest.split(/[\\\/]/).pop()!,
        folder: dest.replace(/[\\\/][^\\\/]+$/, ""),
        size: "720x?",
      });
  });
}

/**
 * Sample N JPEG frames from the video at evenly-spaced timestamps for
 * moderation classification. Returns absolute paths to the saved frames.
 */
async function sampleFrames(
  src: string,
  outDir: string,
  durationMs: number,
): Promise<string[]> {
  await rm(outDir, { recursive: true, force: true }).catch(() => undefined);
  const safeDuration = Math.max(durationMs, 1000);
  const count = FRAME_SAMPLE_COUNT;
  const timestamps = Array.from({ length: count }, (_, i) =>
    String(Math.max(0.1, ((i + 0.5) / count) * (safeDuration / 1000))),
  );

  await new Promise<void>((resolve, reject) => {
    ffmpeg(src)
      .on("end", () => resolve())
      .on("error", reject)
      .screenshots({
        timestamps,
        filename: "frame-%i.jpg",
        folder: outDir,
        size: "320x?",
      });
  });

  const files = await readdir(outDir).catch(() => []);
  return files.filter((f) => f.endsWith(".jpg")).map((f) => join(outDir, f));
}

function transcode(
  src: string,
  dest: string,
  spec: { height: number; bitrateKbps: number },
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(src)
      .videoCodec("libx264")
      .audioCodec("aac")
      .videoBitrate(`${spec.bitrateKbps}k`)
      .audioBitrate("96k")
      .size(`?x${spec.height}`)
      .outputOptions([
        "-preset veryfast",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-profile:v main",
        "-level 4.0",
      ])
      .on("end", () => resolve())
      .on("error", reject)
      .save(dest);
  });
}

async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage
    .from(COMMUNITY_BUCKET)
    .upload(key, body, { contentType, upsert: true });
  if (error) throw new Error(`Upload ${key} failed: ${error.message}`);
}

async function persistModerationResult(
  mediaId: string,
  result: { score: number; labels: { label: string; score: number }[]; reason?: string },
): Promise<void> {
  await supabase
    .from("community_media")
    .update({
      moderation_score: result.score,
      moderation_labels: result.labels,
      moderation_reason: result.reason ?? null,
      moderation_checked_at: new Date().toISOString(),
    })
    .eq("id", mediaId);
}

/**
 * Tear down the offending media: mark failed, delete bytes, email the user
 * with the specific reasons it was rejected.
 */
async function rejectMedia(
  mediaId: string,
  userId: string,
  storageKey: string,
  reason: string,
): Promise<void> {
  log.warn({ mediaId, reason }, "Media rejected by automated moderation");

  await supabase
    .from("community_media")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", mediaId);

  await supabase.storage.from(COMMUNITY_BUCKET).remove([storageKey]).catch((err) => {
    log.warn({ mediaId, err }, "Failed to remove offending source bytes");
  });

  // Look up media + owner for the email
  const { data: media } = await supabase
    .from("community_media")
    .select("moderation_labels")
    .eq("id", mediaId)
    .maybeSingle();

  const { data: userResp } = await supabase.auth.admin.getUserById(userId);
  const email = userResp?.user?.email;
  if (!email) {
    log.warn({ userId, mediaId }, "No email on file — skipping rejection notice");
    return;
  }

  await sendTOSViolationEmail(email, {
    postExcerpt: "(uploaded media)",
    reason,
    reportCount: 0,
    flaggedLabels: ((media?.["moderation_labels"] as { label: string; score: number }[] | null) ?? [])
      .map((l) => l.label),
  });
}
