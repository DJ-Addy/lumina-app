import type { CosmicCard, AstrologyProfile, CreateAstrologyProfileRequest } from "@lumina/shared";
import { apiGet, apiPost } from "../lib/api";

export const astrologyService = {
  getProfile: () => apiGet<{ profile: AstrologyProfile }>("/v1/astrology/profile"),
  createProfile: (data: CreateAstrologyProfileRequest) =>
    apiPost<{ profile: AstrologyProfile }>("/v1/astrology/profile", data),
  getCosmicCard: () => apiGet<CosmicCard>("/v1/astrology/cosmic-card"),
};
