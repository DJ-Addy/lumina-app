import type { ModerationLabel, ModerationLabelHit, ModerationResult } from "@lumina/shared";
import { CRISIS_LABELS } from "@lumina/shared";
import { env } from "./env.js";

const ENDPOINT = "https://api.openai.com/v1/moderations";
const MODEL = "omni-moderation-latest";

/**
 * Map OpenAI moderation category keys to our shared ModerationLabel enum.
 */
const CATEGORY_MAP: Record<string, ModerationLabel> = {
  "sexual": "sexual",
  "sexual/minors": "sexual_minors",
  "harassment": "harassment",
  "harassment/threatening": "harassment_threatening",
  "hate": "hate",
  "hate/threatening": "hate_threatening",
  "self-harm": "self_harm",
  "self-harm/intent": "self_harm_intent",
  "self-harm/instructions": "self_harm_instructions",
  "violence": "violence",
  "violence/graphic": "violence_graphic",
  "illicit": "illicit",
  "illicit/violent": "illicit_violent",
};

interface OpenAIModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

interface OpenAIModerationResponse {
  id: string;
  model: string;
  results: OpenAIModerationResult[];
}

/**
 * Score thresholds — stricter for severe categories.
 * `block` = always reject.
 * `warn` = surface to user but allow ("rephrase?").
 */
const BLOCK_THRESHOLDS: Partial<Record<ModerationLabel, number>> = {
  sexual_minors: 0.1,
  self_harm_instructions: 0.5,
  hate_threatening: 0.5,
  harassment_threatening: 0.5,
  violence_graphic: 0.7,
  sexual: 0.85,
  hate: 0.8,
  harassment: 0.8,
  violence: 0.85,
  illicit: 0.85,
  illicit_violent: 0.7,
  // self_harm intentionally NOT in block list — handled as crisis
  self_harm: 0.0,
  self_harm_intent: 0.0,
};

const DEFAULT_BLOCK = 0.85;

/**
 * Call OpenAI's free moderation endpoint and translate the response into
 * our shared ModerationResult shape.
 *
 * Returns `severity: "allow"` if the call fails (fail-open) — moderation
 * outages should not block legitimate posts.
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  if (!env.OPENAI_API_KEY) {
    return { severity: "allow", labels: [] };
  }

  let payload: OpenAIModerationResponse;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, input: text }),
    });
    if (!res.ok) {
      console.warn("[moderation] OpenAI returned", res.status);
      return { severity: "allow", labels: [] };
    }
    payload = (await res.json()) as OpenAIModerationResponse;
  } catch (err) {
    console.warn("[moderation] OpenAI call failed", err);
    return { severity: "allow", labels: [] };
  }

  const result = payload.results[0];
  if (!result) return { severity: "allow", labels: [] };

  const labels: ModerationLabelHit[] = [];
  for (const [openaiKey, score] of Object.entries(result.category_scores)) {
    const ourLabel = CATEGORY_MAP[openaiKey];
    if (!ourLabel) continue;
    if (typeof score !== "number" || score < 0.2) continue;
    labels.push({ label: ourLabel, score });
  }

  labels.sort((a, b) => b.score - a.score);

  // Crisis routing — self-harm content gets special handling:
  // we DO NOT block, but we surface a hotline.
  const hasCrisis = labels.some((l) => CRISIS_LABELS.has(l.label) && l.score >= 0.5);
  if (hasCrisis) {
    return {
      severity: "crisis",
      labels,
      reason: "We hear you. Please consider reaching out for support.",
    };
  }

  // Block check
  const blocking = labels.find(
    (l) => l.score >= (BLOCK_THRESHOLDS[l.label] ?? DEFAULT_BLOCK),
  );
  if (blocking) {
    return {
      severity: "block",
      labels,
      reason: `Flagged for ${blocking.label.replace(/_/g, " ")} (${Math.round(blocking.score * 100)}% confidence)`,
    };
  }

  // Warn check (any label above 0.5)
  const warning = labels.find((l) => l.score >= 0.5);
  if (warning) {
    return {
      severity: "warn",
      labels,
      reason: `Possible ${warning.label.replace(/_/g, " ")}. Please review before posting.`,
    };
  }

  return { severity: "allow", labels };
}
