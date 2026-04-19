import { Worker } from "bullmq";
import { mkdtemp, readFile, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";
import { redis } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { env } from "../lib/env.js";

ffmpeg.setFfmpegPath((ffmpegPath as unknown as { path: string }).path);
ffmpeg.setFfprobePath((ffprobePath as unknown as { path: string }).path);

const log = pino({ level: "info" });
const COMMUNITY_BUCKET = "community-media";

interface VideoJob {
  mediaId: string;
  userId: string;
  storageKey: string;
}

const VARIANT_SPECS = [
  { label: "480p" as const, height: 480, bitrateKbps: 800 },
  { label: "720p" as const, height: 720, bitrateKbps: 1800 },
];

export function startVideoPipelineWorker() {
  const worker = new Worker<VideoJob>(
    "video.process",
    async (job) => {
      const { mediaId, userId, storageKey } = job.data;
      log.info({ mediaId }, "Video pipeline starting");

      const workDir = await mkdtemp(join(tmpdir(), `video-${mediaId}-`));
      const sourcePath = join(workDir, "source");

      try {
        await supabase.from("community_media").update({ status: "processing" }).eq("id", mediaId);

        // 1. Download source from Supabase Storage
        const { data: blob, error: dlErr } = await supabase.storage
          .from(COMMUNITY_BUCKET)
          .download(storageKey);
        if (dlErr || !blob) throw new Error(`Source download failed: ${dlErr?.message}`);
        await writeFile(sourcePath, Buffer.from(await blob.arrayBuffer()));

        // 2. Probe duration + dimensions
        const meta = await probeVideo(sourcePath);
        log.info({ mediaId, meta }, "Probed source");

        // 3. Generate thumbnail at 1s mark
        const thumbPath = join(workDir, "thumb.jpg");
        await extractThumbnail(sourcePath, thumbPath);
        const thumbKey = `${userId}/${mediaId}/thumb.jpg`;
        const thumbBuf = await readFile(thumbPath);
        await uploadObject(thumbKey, thumbBuf, "image/jpeg");

        // 4. Transcode each variant
        const variants: Array<{ key: string; label: "480p" | "720p"; bitrateKbps: number; codec: string }> = [];
        for (const spec of VARIANT_SPECS) {
          if (meta.height && meta.height < spec.height) continue; // skip upscaling
          const variantPath = join(workDir, `${spec.label}.mp4`);
          await transcode(sourcePath, variantPath, spec);
          const variantKey = `${userId}/${mediaId}/${spec.label}.mp4`;
          const buf = await readFile(variantPath);
          await uploadObject(variantKey, buf, "video/mp4");
          variants.push({ key: variantKey, label: spec.label, bitrateKbps: spec.bitrateKbps, codec: "h264" });
        }

        // If no variants survived (very small source), still publish the original via a 480p key
        if (!variants.length) {
          const variantKey = `${userId}/${mediaId}/source.mp4`;
          const srcBuf = await readFile(sourcePath);
          await uploadObject(variantKey, srcBuf, "video/mp4");
          variants.push({ key: variantKey, label: "480p", bitrateKbps: 800, codec: "h264" });
        }

        // 5. Persist metadata
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

        // 6. Invalidate reels cache so the new reel can be picked up by next refresh
        await redis.del("reels:feed:v1");

        log.info({ mediaId, variants: variants.length }, "Video pipeline complete");
      } catch (err) {
        log.error({ mediaId, err }, "Video pipeline failed");
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
    log.error({ jobId: job?.id, err }, "Video pipeline job failed");
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
