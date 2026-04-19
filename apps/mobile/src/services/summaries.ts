import type { SummaryResponse } from "@lumina/shared";
import { apiGet } from "../lib/api";

export const summaryService = {
  getLatest: () => apiGet<SummaryResponse>("/v1/summaries/latest"),
  getAll: () => apiGet<{ summaries: SummaryResponse["summary"][] }>("/v1/summaries"),
};
