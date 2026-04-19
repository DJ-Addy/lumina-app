import type { TodayPromptResponse } from "@lumina/shared";
import { apiGet } from "../lib/api";

export const promptService = {
  getTodayPrompt: () => apiGet<TodayPromptResponse>("/v1/prompts/today"),
};
