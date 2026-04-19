import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";

export async function promptRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/today", async (request, reply) => {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("baby_birth_date")
      .eq("id", request.user.id)
      .single();

    const babyBirthDate = profile?.["baby_birth_date"] as string | null;
    const weekNumber = babyBirthDate ? getWeekNumber(babyBirthDate) : null;

    let q = supabase.from("prompts").select("*").eq("is_active", true);
    if (weekNumber !== null) {
      q = q
        .or(`week_min.is.null,week_min.lte.${weekNumber}`)
        .or(`week_max.is.null,week_max.gte.${weekNumber}`);
    }

    const { data: prompts, error } = await q.limit(50);
    if (error || !prompts?.length) {
      return reply.status(404).send({ code: "NO_PROMPTS", message: "No prompts available" });
    }

    const randomIndex = Math.floor(Math.random() * prompts.length);
    const prompt = prompts[randomIndex];

    const { data: astrologyRow } = await supabase
      .from("astrology_profiles")
      .select("sun_sign, moon_sign")
      .eq("user_id", request.user.id)
      .single();

    const cosmicContext = astrologyRow
      ? generateCosmicContext(astrologyRow["moon_sign"] as string | null)
      : null;

    return reply.send({
      prompt: mapPrompt(prompt),
      cosmicContext,
      moonPhase: getCurrentMoonPhase(),
    });
  });
}

function mapPrompt(row: Record<string, unknown>) {
  return {
    id: row["id"],
    text: row["text"],
    category: row["category"],
    weekMin: row["week_min"],
    weekMax: row["week_max"],
    isMoonPhase: row["is_moon_phase"],
    isFeatured: row["is_featured"],
    createdAt: row["created_at"],
  };
}

function getWeekNumber(babyBirthDate: string): number {
  const birth = new Date(babyBirthDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.floor(diffDays / 7), 52);
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

function generateCosmicContext(moonSign: string | null): string {
  if (!moonSign) return "The moon invites you to turn inward tonight.";
  return `Today's ${moonSign} moon may amplify emotional sensitivity. Use tonight's journal to name what's sitting beneath the surface.`;
}
