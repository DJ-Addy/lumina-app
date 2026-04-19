import type { NightFeedResponse } from "@lumina/shared";
import { apiGet } from "../lib/api";

export const nightModeService = {
  getFeed: () => apiGet<NightFeedResponse>("/v1/night/feed"),
};
