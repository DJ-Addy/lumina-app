import pino from "pino";
import type { ModerationLabelHit } from "@lumina/shared";

const log = pino({ level: "info" });

/**
 * Public-domain NSFW image classifier hosted on Hugging Face.
 * Returns labels: "normal" | "nsfw".
 */
const MODEL_ID = "Falconsai/nsfw_image_detection";
const NSFW_BLOCK_THRESHOLD = 0.85;
const NSFW_WARN_THRESHOLD = 0.55;

type Classifier = (input: string) => Promise<Array<{ label: string; score: number }>>;

let pipelinePromise: Promise<Classifier> | null = null;

/**
 * Lazily initialise the classifier on first call. The model is ~80 MB and
 * is cached to disk by transformers.js, so subsequent worker boots are fast.
 */
async function getClassifier(): Promise<Classifier> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      log.info({ model: MODEL_ID }, "Loading NSFW classifier (first run only)");
      const { pipeline } = await import("@huggingface/transformers");
      const p = await pipeline("image-classification", MODEL_ID);
      log.info("NSFW classifier ready");
      return p as unknown as Classifier;
    })();
  }
  return pipelinePromise;
}

export interface ImageModerationResult {
  flagged: boolean;
  severity: "allow" | "warn" | "block";
  score: number;
  labels: ModerationLabelHit[];
  reason?: string;
}

/**
 * Classify a single image file path. Returns the worst label across the
 * model output. `flagged` is true when the score exceeds the warn threshold.
 */
export async function classifyImage(filePath: string): Promise<ImageModerationResult> {
  const classifier = await getClassifier();
  const raw = await classifier(filePath);

  const nsfw = raw.find((r) => r.label.toLowerCase() === "nsfw");
  const score = nsfw?.score ?? 0;

  const severity: ImageModerationResult["severity"] =
    score >= NSFW_BLOCK_THRESHOLD ? "block" : score >= NSFW_WARN_THRESHOLD ? "warn" : "allow";

  const labels: ModerationLabelHit[] = score >= NSFW_WARN_THRESHOLD
    ? [{ label: "sexual", score }]
    : [];

  const result: ImageModerationResult = {
    flagged: severity !== "allow",
    severity,
    score,
    labels,
  };
  if (severity === "block") {
    result.reason = `Sexual content detected (confidence ${Math.round(score * 100)}%)`;
  }
  return result;
}

/**
 * Classify multiple frames and aggregate to the worst result.
 * Used by the video pipeline before transcoding.
 */
export async function classifyFrames(
  framePaths: string[],
): Promise<ImageModerationResult & { perFrameScores: number[] }> {
  if (framePaths.length === 0) {
    return {
      flagged: false,
      severity: "allow",
      score: 0,
      labels: [],
      perFrameScores: [],
    };
  }

  const results = await Promise.all(framePaths.map((p) => classifyImage(p)));
  const perFrameScores = results.map((r) => r.score);
  const worst = results.reduce((acc, r) => (r.score > acc.score ? r : acc), results[0]!);

  return { ...worst, perFrameScores };
}

export const NSFW_THRESHOLDS = {
  block: NSFW_BLOCK_THRESHOLD,
  warn: NSFW_WARN_THRESHOLD,
};
