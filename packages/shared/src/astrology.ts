import { z } from "zod";

export const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export const ZodiacSignSchema = z.enum(ZODIAC_SIGNS);
export type ZodiacSign = z.infer<typeof ZodiacSignSchema>;

export const PLANET_KEYS = [
  "sun",
  "moon",
  "ascendant",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
] as const;
export const PlanetKeySchema = z.enum(PLANET_KEYS);
export type PlanetKey = z.infer<typeof PlanetKeySchema>;

export const PlacementSchema = z.object({
  planet: PlanetKeySchema,
  sign: ZodiacSignSchema,
  degree: z.number().min(0).max(30),
  retrograde: z.boolean().default(false),
  house: z.number().int().min(1).max(12).optional().nullable(),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const NatalChartSchema = z.object({
  birthDate: z.string().date(),
  birthTime: z.string().nullable(),
  birthPlace: z.string().nullable(),
  hasExactTime: z.boolean(),
  placements: z.array(PlacementSchema),
  generatedAt: z.string(),
});
export type NatalChart = z.infer<typeof NatalChartSchema>;

export const AstrologyProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  birthDate: z.string().date(),
  birthTime: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  birthLatitude: z.number().nullable().optional(),
  birthLongitude: z.number().nullable().optional(),
  sunSign: z.string(),
  moonSign: z.string().nullable(),
  risingSign: z.string().nullable(),
  natalChart: NatalChartSchema.nullable().optional(),
  babyBirthDate: z.string().date().optional().nullable(),
  babySunSign: z.string().nullable(),
});
export type AstrologyProfile = z.infer<typeof AstrologyProfileSchema>;

export const CreateAstrologyProfileRequestSchema = z.object({
  birthDate: z.string().date(),
  birthTime: z.string().optional(),
  birthPlace: z.string().optional(),
  birthLatitude: z.number().min(-90).max(90).optional(),
  birthLongitude: z.number().min(-180).max(180).optional(),
  babyBirthDate: z.string().date().optional(),
});
export type CreateAstrologyProfileRequest = z.infer<typeof CreateAstrologyProfileRequestSchema>;

export const CosmicCardSchema = z.object({
  moonPhase: z.string(),
  moonSign: z.string(),
  dailyContext: z.string(),
  weeklyForecast: z.string().nullable(),
  momBabyInsight: z.string().nullable(),
  journalPromptSuggestion: z.string().nullable(),
  date: z.string().date(),
});
export type CosmicCard = z.infer<typeof CosmicCardSchema>;

export const HOROSCOPE_DOMAINS = ["work", "home", "love", "friends"] as const;
export const HoroscopeDomainSchema = z.enum(HOROSCOPE_DOMAINS);
export type HoroscopeDomain = z.infer<typeof HoroscopeDomainSchema>;

export const HoroscopeSliceSchema = z.object({
  domain: HoroscopeDomainSchema,
  title: z.string(),
  body: z.string(),
  vibe: z.enum(["expansive", "tender", "tense", "grounded", "luminous", "still"]),
  intensity: z.number().int().min(1).max(5),
  do: z.string(),
  dont: z.string(),
  /** When personalised, a short note about the active transit-to-natal aspect. */
  note: z.string().optional(),
});
export type HoroscopeSlice = z.infer<typeof HoroscopeSliceSchema>;

export const DailyHoroscopeSchema = z.object({
  date: z.string().date(),
  sunSign: ZodiacSignSchema.nullable(),
  moonSign: ZodiacSignSchema,
  moonPhase: z.string(),
  headline: z.string(),
  slices: z.array(HoroscopeSliceSchema),
});
export type DailyHoroscope = z.infer<typeof DailyHoroscopeSchema>;
