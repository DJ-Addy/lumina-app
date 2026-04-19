import type { FastifyInstance } from "fastify";
import { CreateAstrologyProfileRequestSchema } from "@lumina/shared";
import { supabase } from "../lib/supabase.js";

const SUN_SIGNS = [
  { sign: "Aries", startMonth: 3, startDay: 21 },
  { sign: "Taurus", startMonth: 4, startDay: 20 },
  { sign: "Gemini", startMonth: 5, startDay: 21 },
  { sign: "Cancer", startMonth: 6, startDay: 21 },
  { sign: "Leo", startMonth: 7, startDay: 23 },
  { sign: "Virgo", startMonth: 8, startDay: 23 },
  { sign: "Libra", startMonth: 9, startDay: 23 },
  { sign: "Scorpio", startMonth: 10, startDay: 23 },
  { sign: "Sagittarius", startMonth: 11, startDay: 22 },
  { sign: "Capricorn", startMonth: 12, startDay: 22 },
  { sign: "Aquarius", startMonth: 1, startDay: 20 },
  { sign: "Pisces", startMonth: 2, startDay: 19 },
];

export async function astrologyRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/profile", async (request, reply) => {
    const body = CreateAstrologyProfileRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const sunSign = getSunSign(body.data.birthDate);
    const babySunSign = body.data.babyBirthDate ? getSunSign(body.data.babyBirthDate) : null;

    const { data, error } = await supabase
      .from("astrology_profiles")
      .upsert({
        user_id: request.user.id,
        birth_date: body.data.birthDate,
        birth_time: body.data.birthTime ?? null,
        birth_place: body.data.birthPlace ?? null,
        sun_sign: sunSign,
        moon_sign: null,
        rising_sign: null,
        baby_birth_date: body.data.babyBirthDate ?? null,
        baby_sun_sign: babySunSign,
      })
      .select()
      .single();

    if (error || !data) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to save astrology profile" });
    }

    return reply.status(201).send({ profile: mapAstrologyProfile(data) });
  });

  fastify.get("/profile", async (request, reply) => {
    const { data, error } = await supabase
      .from("astrology_profiles")
      .select()
      .eq("user_id", request.user.id)
      .single();

    if (error || !data) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "No astrology profile yet" });
    }
    return reply.send({ profile: mapAstrologyProfile(data) });
  });

  fastify.get("/cosmic-card", async (request, reply) => {
    const { data: astroProfile } = await supabase
      .from("astrology_profiles")
      .select()
      .eq("user_id", request.user.id)
      .single();

    const moonPhase = getCurrentMoonPhase();
    const moonSign = getMoonSign();
    const today = new Date().toISOString().split("T")[0]!;

    return reply.send({
      moonPhase,
      moonSign,
      dailyContext: generateDailyContext(
        moonPhase,
        moonSign,
        astroProfile?.["sun_sign"] as string | null,
      ),
      weeklyForecast: null,
      momBabyInsight:
        astroProfile?.["baby_sun_sign"]
          ? generateMomBabyInsight(
              astroProfile["sun_sign"] as string,
              astroProfile["baby_sun_sign"] as string,
            )
          : null,
      journalPromptSuggestion: generateCosmicPrompt(moonPhase),
      date: today,
    });
  });
}

function getSunSign(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const { sign, startMonth, startDay } of SUN_SIGNS) {
    const nextSign = SUN_SIGNS[(SUN_SIGNS.indexOf({ sign, startMonth, startDay }) + 1) % 12];
    if (!nextSign) continue;
    if (
      (month === startMonth && day >= startDay) ||
      (month === nextSign.startMonth && day < nextSign.startDay)
    ) {
      return sign;
    }
  }
  return "Capricorn";
}

function getCurrentMoonPhase(): string {
  const phases = [
    "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
    "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
  ];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return phases[Math.floor((dayOfYear % 29.5) / 3.7) % 8] ?? "New Moon";
}

function getMoonSign(): string {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return signs[Math.floor(dayOfYear / 2.5) % 12] ?? "Cancer";
}

function generateDailyContext(moonPhase: string, moonSign: string, sunSign: string | null): string {
  const base = `Today's ${moonSign} moon (${moonPhase}) invites you to notice what's sitting quietly beneath the surface.`;
  if (sunSign) {
    return `${base} As a ${sunSign}, this energy may feel especially ${moonSign === sunSign ? "familiar" : "expansive"} today.`;
  }
  return base;
}

function generateMomBabyInsight(momSign: string, babySign: string): string {
  return `Your ${momSign} energy and your little ${babySign}'s spirit are learning each other's rhythms. There is no rush.`;
}

function generateCosmicPrompt(moonPhase: string): string {
  const prompts: Record<string, string> = {
    "New Moon": "What intention are you quietly planting for yourself this cycle?",
    "Full Moon": "What has come to light this month that you couldn't see before?",
    "Waxing Crescent": "What small thing are you nurturing today?",
    "Waning Crescent": "What are you ready to release?",
  };
  return prompts[moonPhase] ?? "What does this moment ask of you?";
}

function mapAstrologyProfile(row: Record<string, unknown>) {
  return {
    id: row["id"],
    userId: row["user_id"],
    birthDate: row["birth_date"],
    birthTime: row["birth_time"],
    birthPlace: row["birth_place"],
    sunSign: row["sun_sign"],
    moonSign: row["moon_sign"],
    risingSign: row["rising_sign"],
    babyBirthDate: row["baby_birth_date"],
    babySunSign: row["baby_sun_sign"],
  };
}
