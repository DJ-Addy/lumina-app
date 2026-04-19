import type {
  AstrologyProfile,
  CosmicCard,
  CreateAstrologyProfileRequest,
  DailyHoroscope,
  NatalChart,
} from "@lumina/shared";
import { apiGet, apiPost } from "../lib/api";
import { hasSupabaseConfig } from "../lib/supabase";
import { demoAstroStore } from "./demoAstroStore";

export const astrologyService = {
  getProfile: () => apiGet<{ profile: AstrologyProfile }>("/v1/astrology/profile"),

  createProfile: async (data: CreateAstrologyProfileRequest) => {
    if (!hasSupabaseConfig) {
      await demoAstroStore.saveBirth({
        birthDate: data.birthDate,
        birthTime: data.birthTime ?? null,
        birthPlace: data.birthPlace ?? null,
        latitude: data.birthLatitude ?? null,
        longitude: data.birthLongitude ?? null,
      });
      return { ok: true } as const;
    }
    return apiPost<{ profile: AstrologyProfile }>("/v1/astrology/profile", data);
  },

  getCosmicCard: () => apiGet<CosmicCard>("/v1/astrology/cosmic-card"),

  getNatalChart: async (): Promise<{ chart: NatalChart | null }> => {
    if (!hasSupabaseConfig) {
      const chart = await demoAstroStore.getNatalChart();
      return { chart };
    }
    try {
      return await apiGet<{ chart: NatalChart }>("/v1/astrology/natal-chart");
    } catch {
      return { chart: null };
    }
  },

  getDailyHoroscope: async (): Promise<DailyHoroscope> => {
    if (!hasSupabaseConfig) return demoAstroStore.getDailyHoroscope();
    return apiGet<DailyHoroscope>("/v1/astrology/daily-horoscope");
  },

  getStoredBirth: () => demoAstroStore.getBirth(),
};
