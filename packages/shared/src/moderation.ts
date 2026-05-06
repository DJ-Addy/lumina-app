import { z } from "zod";

/**
 * Canonical moderation labels used across the stack.
 * - `sexual` / `sexual_minors` come from image and text classifiers.
 * - `harassment`, `hate`, `self_harm`, `violence`, `illicit` come from text.
 * - `spam_link`, `pii_phone`, `pii_email`, `shouting`, `repetition` come from
 *   the local regex layer 0 on mobile.
 */
export const ModerationLabel = z.enum([
  "sexual",
  "sexual_minors",
  "harassment",
  "harassment_threatening",
  "hate",
  "hate_threatening",
  "self_harm",
  "self_harm_intent",
  "self_harm_instructions",
  "violence",
  "violence_graphic",
  "illicit",
  "illicit_violent",
  "spam_link",
  "pii_phone",
  "pii_email",
  "shouting",
  "repetition",
  "scam",
]);
export type ModerationLabel = z.infer<typeof ModerationLabel>;

export const ModerationLabelHit = z.object({
  label: ModerationLabel,
  score: z.number().min(0).max(1),
});
export type ModerationLabelHit = z.infer<typeof ModerationLabelHit>;

export const ModerationSeverity = z.enum(["allow", "warn", "block", "crisis"]);
export type ModerationSeverity = z.infer<typeof ModerationSeverity>;

export const ModerationResultSchema = z.object({
  severity: ModerationSeverity,
  labels: z.array(ModerationLabelHit),
  reason: z.string().optional(),
});
export type ModerationResult = z.infer<typeof ModerationResultSchema>;

export const ModerateTextRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  surface: z.enum(["post", "comment", "poll", "bio"]).default("post"),
});
export type ModerateTextRequest = z.infer<typeof ModerateTextRequestSchema>;

export const ModerateTextResponseSchema = ModerationResultSchema;
export type ModerateTextResponse = z.infer<typeof ModerateTextResponseSchema>;

/** Friendly user-facing copy per label. */
export const MODERATION_LABEL_COPY: Record<ModerationLabel, string> = {
  sexual: "Sexual content",
  sexual_minors: "Content involving minors",
  harassment: "Harassment of another person",
  harassment_threatening: "Threats toward another person",
  hate: "Hateful content",
  hate_threatening: "Hateful threats",
  self_harm: "Self-harm content",
  self_harm_intent: "Stated self-harm intent",
  self_harm_instructions: "Instructions to self-harm",
  violence: "Graphic violence",
  violence_graphic: "Graphic violence",
  illicit: "Illegal activity",
  illicit_violent: "Illegal violent activity",
  spam_link: "Suspicious link",
  pii_phone: "Phone number",
  pii_email: "Email address",
  shouting: "All-caps shouting",
  repetition: "Excessive character repetition",
  scam: "Likely scam",
};

/** Labels that should trigger the crisis-support flow rather than a blunt block. */
export const CRISIS_LABELS: ReadonlySet<ModerationLabel> = new Set<ModerationLabel>([
  "self_harm",
  "self_harm_intent",
  "self_harm_instructions",
]);
