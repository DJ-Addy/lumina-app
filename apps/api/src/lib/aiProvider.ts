import { streamGeminiReply } from "./providers/gemini.js";
import { streamClaudeReply } from "./providers/claude.js";
import type { AiTier, StreamChatFn } from "./providers/types.js";

export function getProviderForTier(tier: AiTier): StreamChatFn {
  if (tier === "pro") return streamClaudeReply;
  return streamGeminiReply;
}

export type { ChatTurn, AiTier } from "./providers/types.js";
