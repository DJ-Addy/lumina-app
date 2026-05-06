import type { ModerationLabelHit } from "@lumina/shared";

/**
 * Layer 0: deterministic, offline regex checks for the dumb stuff.
 *
 * These exist to catch spam patterns and contact info quickly without a
 * network call. The smart classification (hate, harassment, self-harm,
 * sexual content) happens in Layer 1 via the OpenAI moderation API.
 */

const RULES: Array<{
  name:
    | "spam_link"
    | "pii_phone"
    | "pii_email"
    | "shouting"
    | "repetition"
    | "scam";
  pattern: RegExp;
  score: number;
  reason: string;
}> = [
  {
    name: "spam_link",
    pattern: /\b(?:bit\.ly|t\.co|tinyurl\.com|goo\.gl|cutt\.ly|is\.gd|rb\.gy)\b/i,
    score: 1,
    reason: "Shortened links aren't allowed in posts.",
  },
  {
    name: "scam",
    pattern:
      /\b(?:dm\s+me|join\s+my\s+(?:onlyfans|telegram|whatsapp)|earn\s+\$?\d{2,}|crypto\s+(?:tip|airdrop)|nft\s+drop)\b/i,
    score: 1,
    reason: "This looks like spam or a scam.",
  },
  {
    name: "pii_phone",
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    score: 0.9,
    reason: "Don't share phone numbers in public posts.",
  },
  {
    name: "pii_email",
    pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/,
    score: 0.9,
    reason: "Don't share email addresses in public posts.",
  },
  {
    name: "shouting",
    pattern: /^[^a-z]{40,}$/m,
    score: 0.6,
    reason: "Posts written entirely in caps come across as shouting.",
  },
  {
    name: "repetition",
    pattern: /(.)\1{7,}/,
    score: 0.6,
    reason: "Excessive repeated characters detected.",
  },
];

export interface RegexCheck {
  hits: ModerationLabelHit[];
  /** First reason we want to show the user. */
  primaryReason?: string;
  blocking: boolean;
}

export function runRegexRules(text: string): RegexCheck {
  const hits: ModerationLabelHit[] = [];
  let primaryReason: string | undefined;
  let blocking = false;

  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      hits.push({ label: rule.name, score: rule.score });
      if (!primaryReason) primaryReason = rule.reason;
      if (rule.score >= 0.9) blocking = true;
    }
  }

  return {
    hits,
    ...(primaryReason !== undefined ? { primaryReason } : {}),
    blocking,
  };
}
