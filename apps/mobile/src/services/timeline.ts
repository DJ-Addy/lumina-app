import type { TimelineResponse } from "@lumina/shared";
import { apiGet } from "../lib/api";
import { hasSupabaseConfig } from "../lib/supabase";
import { demoJournalStore } from "./demoStore";

export const timelineService = {
  getTimeline: (): Promise<TimelineResponse> => {
    if (!hasSupabaseConfig) return demoJournalStore.getTimeline();
    return apiGet<TimelineResponse>("/v1/timeline");
  },
};
