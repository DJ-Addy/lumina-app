import type { FastifyInstance } from "fastify";
import { CreateAstrologyProfileRequestSchema, type Placement, type ZodiacSign } from "@lumina/shared";
import { supabase } from "../lib/supabase.js";
import { computeNatalChart, quickSunSign } from "../lib/natalChart.js";
import { buildDailyHoroscope } from "../lib/dailyHoroscope.js";

export async function astrologyRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/profile", async (request, reply) => {
    const body = CreateAstrologyProfileRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: body.error.message });
    }

    const chart = computeNatalChart({
      birthDate: body.data.birthDate,
      birthTime: body.data.birthTime ?? null,
      birthPlace: body.data.birthPlace ?? null,
      latitude: body.data.birthLatitude ?? null,
      longitude: body.data.birthLongitude ?? null,
    });

    const sunSign =
      chart.placements.find((p: Placement) => p.planet === "sun")?.sign ??
      quickSunSign(body.data.birthDate);
    const moonSign = chart.placements.find((p: Placement) => p.planet === "moon")?.sign ?? null;
    const risingSign =
      chart.placements.find((p: Placement) => p.planet === "ascendant")?.sign ?? null;
    const babySunSign = body.data.babyBirthDate ? quickSunSign(body.data.babyBirthDate) : null;

    const { data, error } = await supabase
      .from("astrology_profiles")
      .upsert({
        user_id: request.user.id,
        birth_date: body.data.birthDate,
        birth_time: body.data.birthTime ?? null,
        birth_place: body.data.birthPlace ?? null,
        birth_latitude: body.data.birthLatitude ?? null,
        birth_longitude: body.data.birthLongitude ?? null,
        sun_sign: sunSign,
        moon_sign: moonSign,
        rising_sign: risingSign,
        natal_chart: chart,
        baby_birth_date: body.data.babyBirthDate ?? null,
        baby_sun_sign: babySunSign,
      })
      .select()
      .single();

    if (error || !data) {
      return reply
        .status(500)
        .send({ code: "DB_ERROR", message: "Failed to save astrology profile" });
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

  fastify.get("/natal-chart", async (request, reply) => {
    const { data } = await supabase
      .from("astrology_profiles")
      .select()
      .eq("user_id", request.user.id)
      .single();

    if (!data) {
      return reply
        .status(404)
        .send({ code: "NOT_FOUND", message: "Add your birth date in profile setup first." });
    }

    const cached = data["natal_chart"] as ReturnType<typeof computeNatalChart> | null;
    if (cached) return reply.send({ chart: cached });

    const chart = computeNatalChart({
      birthDate: data["birth_date"] as string,
      birthTime: (data["birth_time"] as string | null) ?? null,
      birthPlace: (data["birth_place"] as string | null) ?? null,
      latitude: (data["birth_latitude"] as number | null) ?? null,
      longitude: (data["birth_longitude"] as number | null) ?? null,
    });

    await supabase
      .from("astrology_profiles")
      .update({ natal_chart: chart })
      .eq("user_id", request.user.id);

    return reply.send({ chart });
  });

  fastify.get("/daily-horoscope", async (request, reply) => {
    const { data } = await supabase
      .from("astrology_profiles")
      .select()
      .eq("user_id", request.user.id)
      .single();

    const sunSign = (data?.["sun_sign"] as ZodiacSign | null) ?? null;

    // Try cached natal chart first; fall back to recomputing.
    let natal = (data?.["natal_chart"] as ReturnType<typeof computeNatalChart> | null) ?? null;
    if (!natal && data?.["birth_date"]) {
      natal = computeNatalChart({
        birthDate: data["birth_date"] as string,
        birthTime: (data["birth_time"] as string | null) ?? null,
        birthPlace: (data["birth_place"] as string | null) ?? null,
        latitude: (data["birth_latitude"] as number | null) ?? null,
        longitude: (data["birth_longitude"] as number | null) ?? null,
      });
    }

    const horoscope = await buildDailyHoroscope({ sunSign, natal });
    return reply.send(horoscope);
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
      momBabyInsight: astroProfile?.["baby_sun_sign"]
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

function getCurrentMoonPhase(): string {
  const phases = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return phases[Math.floor((dayOfYear % 29.5) / 3.7) % 8] ?? "New Moon";
}

function getMoonSign(): string {
  const signs = [
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
  ];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return signs[Math.floor(dayOfYear / 2.5) % 12] ?? "Cancer";
}

function generateDailyContext(
  moonPhase: string,
  moonSign: string,
  sunSign: string | null,
): string {
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
    birthLatitude: row["birth_latitude"] ?? null,
    birthLongitude: row["birth_longitude"] ?? null,
    sunSign: row["sun_sign"],
    moonSign: row["moon_sign"],
    risingSign: row["rising_sign"],
    natalChart: row["natal_chart"] ?? null,
    babyBirthDate: row["baby_birth_date"],
    babySunSign: row["baby_sun_sign"],
  };
}
