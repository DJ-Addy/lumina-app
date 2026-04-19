import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import { LUMINA_SYSTEM_PROMPT } from "./prompt.js";
import type { ChatTurn, StreamChatFn } from "./types.js";

const client = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  : null;

export const streamClaudeReply: StreamChatFn = async function* (
  history: ChatTurn[],
  userMessage: string,
  moodTags: string[],
) {
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const moodContext =
    moodTags.length > 0
      ? `\n\n[She has tagged her current state as: ${moodTags.join(", ")}]`
      : "";

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: userMessage + moodContext },
  ];

  const stream = client.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: LUMINA_SYSTEM_PROMPT,
    messages,
  });

  let full = "";
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const text = event.delta.text;
      full += text;
      yield text;
    }
  }
  return full;
};
