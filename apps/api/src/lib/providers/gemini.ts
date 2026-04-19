import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env.js";
import { LUMINA_SYSTEM_PROMPT } from "./prompt.js";
import type { ChatTurn, StreamChatFn } from "./types.js";

const client = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

export const streamGeminiReply: StreamChatFn = async function* (
  history: ChatTurn[],
  userMessage: string,
  moodTags: string[],
) {
  const moodContext =
    moodTags.length > 0
      ? `\n\n[She has tagged her current state as: ${moodTags.join(", ")}]`
      : "";

  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction: LUMINA_SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: 400, temperature: 0.8 },
  });

  const geminiHistory = history.map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessageStream(userMessage + moodContext);

  let full = "";
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      full += text;
      yield text;
    }
  }
  return full;
};
