import nodemailer, { type Transporter } from "nodemailer";
import pino from "pino";
import { env } from "./env.js";

const log = pino({ level: "info" });

let transport: Transporter | null = null;
let warnedNoSmtp = false;

function getTransport(): Transporter | null {
  if (transport) return transport;
  if (!env.SMTP_HOST) {
    if (!warnedNoSmtp) {
      log.warn("SMTP_HOST not set — emails will be logged only, never sent.");
      warnedNoSmtp = true;
    }
    return null;
  }
  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
  return transport;
}

export interface ViolationContext {
  postExcerpt: string;
  reason: string;
  reportCount: number;
  flaggedLabels?: string[];
  appealUrl?: string;
}

export async function sendTOSViolationEmail(to: string, ctx: ViolationContext): Promise<void> {
  const subject = "[Lumina] Your post was removed for a community guidelines violation";

  const reportLine = ctx.reportCount > 0 ? `Reports received: ${ctx.reportCount}\n` : "";
  const labelsLine = ctx.flaggedLabels?.length
    ? `Flagged for: ${ctx.flaggedLabels.map(humanReason).join(", ")}\n`
    : "";

  const text = `Hi,

We removed one of your community posts after an automated review and/or
community reports.

Reason: ${humanReason(ctx.reason)}
${labelsLine}${reportLine}Excerpt: "${ctx.postExcerpt.slice(0, 200)}${ctx.postExcerpt.length > 200 ? "…" : ""}"

We hold space for hard motherhood feelings — and we also hold the line on safety.
Posts that target other moms, spread harm, or break our community guidelines are
removed. Repeated violations may suspend your account (3 strikes).

If you believe this was a mistake, you can appeal at:
${ctx.appealUrl ?? `${env.APP_URL}/community/appeal`}

— The Lumina Trust & Safety team`;

  await send({ to, subject, text });
}

export async function sendAccountSuspendedEmail(to: string, reason: string): Promise<void> {
  const subject = "[Lumina] Your account has been suspended";
  const text = `Hi,

Your Lumina community account has been suspended after repeated guideline violations.

Reason: ${reason}

You can no longer post, comment, react, or follow other moms. The rest of the
Lumina app — your journal, timeline, summaries — remains private to you.

If you believe this was an error, please reply to this email and a human will
review your case within 5 business days.

— The Lumina Trust & Safety team`;

  await send({ to, subject, text });
}

async function send(payload: { to: string; subject: string; text: string }) {
  const t = getTransport();
  if (!t) {
    log.info({ to: payload.to, subject: payload.subject }, "[email-skipped] (no SMTP configured)");
    return;
  }
  try {
    await t.sendMail({
      from: env.EMAIL_FROM,
      ...payload,
    });
    log.info({ to: payload.to, subject: payload.subject }, "Email sent");
  } catch (err) {
    log.error({ to: payload.to, err }, "Email send failed");
  }
}

function humanReason(code: string): string {
  switch (code) {
    case "harmful_content": return "Harmful or unsafe content";
    case "spam": return "Spam";
    case "misinformation": return "Misinformation";
    case "harassment": return "Harassment of another member";
    case "harassment_threatening": return "Threats toward another member";
    case "hate": return "Hateful content";
    case "hate_threatening": return "Hateful threats";
    case "self_harm": return "Self-harm content";
    case "self_harm_intent": return "Stated self-harm intent";
    case "self_harm_instructions": return "Instructions to self-harm";
    case "sexual": return "Sexual content";
    case "sexual_minors": return "Sexual content involving minors";
    case "violence": return "Graphic violence";
    case "violence_graphic": return "Graphic violence";
    case "illicit": return "Illegal activity";
    case "illicit_violent": return "Illegal violent activity";
    default: return code.length > 0 ? code.replace(/_/g, " ") : "Community guidelines violation";
  }
}
