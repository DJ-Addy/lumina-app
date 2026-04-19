export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type StreamChatFn = (
  history: ChatTurn[],
  userMessage: string,
  moodTags: string[],
) => AsyncGenerator<string, string, void>;

export type AiTier = "free" | "pro";
