import Anthropic from "@anthropic-ai/sdk";
import { env } from "../lib/env.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface SummaryInput {
  entries: Array<{ content: string; moodTags: string[]; createdAt: string }>;
  cadence: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
}

export interface SummaryOutput {
  narrativeText: string;
  affirmation: string;
  emotionWordCloud: Record<string, number>;
  highlights: string[];
}

const SYSTEM_PROMPT = `You are Lumina's compassionate reflection companion. You summarize a mother's postpartum journal entries with warmth, honesty, and care.

Rules:
- Use warm, poetic, non-clinical language
- Never diagnose, prescribe, or suggest medical action
- Do not minimize pain or over-praise
- Speak directly to the user as "you"
- Highlight moments of both struggle and joy
- Keep narrative to 3-4 sentences
- Affirmation should be generated from the user's own words
- Response must be valid JSON`;

export async function generateSummary(input: SummaryInput): Promise<SummaryOutput> {
  const entriesText = input.entries
    .map((e, i) => `Entry ${i + 1} (${e.createdAt.split("T")[0]}): ${e.content}`)
    .join("\n\n");

  const userPrompt = `Here are journal entries from ${input.periodStart} to ${input.periodEnd}:

${entriesText}

Return a JSON object with exactly these fields:
{
  "narrativeText": "3-4 sentence warm summary",
  "affirmation": "one sentence using the user's own words",
  "emotionWordCloud": { "word": count },
  "highlights": ["up to 3 meaningful moments"]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude response contained no JSON");

  return JSON.parse(jsonMatch[0]) as SummaryOutput;
}

export async function generatePartnerInsightCard(
  entries: Array<{ content: string; moodTags: string[] }>,
): Promise<{ cardText: string; needsList: string[] }> {
  const text = entries.map((e) => e.content).join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    system:
      "You help postpartum mothers communicate their needs to their partners, gently and without blame. Never clinical. Never preachy. Return valid JSON only.",
    messages: [
      {
        role: "user",
        content: `Based on these journal entries:\n\n${text}\n\nReturn JSON: { "cardText": "one paragraph phrased as insight not complaint", "needsList": ["up to 3 specific needs"] }`,
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") throw new Error("No text from Claude");
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");
  return JSON.parse(jsonMatch[0]) as { cardText: string; needsList: string[] };
}
