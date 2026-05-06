import type { ModerationResult } from "@lumina/shared";
import { apiPost, hasApiConfig, isDemoModeError } from "../api";
import { runRegexRules } from "./textRules";

/**
 * Run text through both layers and return a single ModerationResult.
 *
 *   Layer 0 — local regex (instant, offline)
 *   Layer 1 — POST /v1/moderation/text → OpenAI Moderation API (~150ms)
 *
 * If the network call fails or we're in demo mode, we fall back to the
 * regex-only result. Server-side, post creation re-runs Layer 1 anyway.
 */
export async function screenText(
  text: string,
  surface: "post" | "comment" | "poll" | "bio" = "post",
): Promise<ModerationResult> {
  const trimmed = text.trim();
  if (!trimmed) return { severity: "allow", labels: [] };

  // Layer 0
  const local = runRegexRules(trimmed);
  if (local.blocking) {
    return {
      severity: "block",
      labels: local.hits,
      ...(local.primaryReason !== undefined ? { reason: local.primaryReason } : {}),
    };
  }

  // Layer 1 — only call API if configured. In demo mode, regex-only is fine.
  if (!hasApiConfig) {
    return {
      severity: local.hits.length > 0 ? "warn" : "allow",
      labels: local.hits,
      ...(local.primaryReason !== undefined ? { reason: local.primaryReason } : {}),
    };
  }

  try {
    const remote = await apiPost<ModerationResult>("/v1/moderation/text", {
      text: trimmed,
      surface,
    });

    // Merge: take the worse of the two severities, union the labels.
    const merged: ModerationResult = {
      severity: pickWorse(local.blocking ? "block" : local.hits.length ? "warn" : "allow", remote.severity),
      labels: [...remote.labels, ...local.hits],
      ...(remote.reason
        ? { reason: remote.reason }
        : local.primaryReason !== undefined
        ? { reason: local.primaryReason }
        : {}),
    };
    return merged;
  } catch (err) {
    if (isDemoModeError(err)) {
      return {
        severity: local.hits.length > 0 ? "warn" : "allow",
        labels: local.hits,
        ...(local.primaryReason !== undefined ? { reason: local.primaryReason } : {}),
      };
    }
    console.warn("[moderation] remote check failed; falling back to regex-only", err);
    return {
      severity: local.hits.length > 0 ? "warn" : "allow",
      labels: local.hits,
      ...(local.primaryReason !== undefined ? { reason: local.primaryReason } : {}),
    };
  }
}

const SEVERITY_ORDER = ["allow", "warn", "crisis", "block"] as const;
type Severity = (typeof SEVERITY_ORDER)[number];
function pickWorse(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

export { runRegexRules };
