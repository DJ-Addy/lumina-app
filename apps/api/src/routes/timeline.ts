import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";

const DEFAULT_CHECKPOINTS = [
  { weekNumber: 1, monthNumber: null, label: "Week 1", description: "The first week. The hardest week." },
  { weekNumber: 6, monthNumber: null, label: "Week 6", description: "The postpartum checkup week." },
  { weekNumber: null, monthNumber: 3, label: "Month 3", description: "Starting to find a rhythm (or not)." },
  { weekNumber: null, monthNumber: 6, label: "Month 6", description: "Half a year in." },
  { weekNumber: null, monthNumber: 12, label: "Month 12", description: "One whole year. Look how far you've come." },
];

export async function timelineRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request, reply) => {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("baby_birth_date, subscription_tier")
      .eq("id", request.user.id)
      .single();

    const babyBirthDate = profile?.["baby_birth_date"] as string | null;
    const tier = (profile?.["subscription_tier"] as string) ?? "free";

    const { weekNumber: currentWeek, monthNumber: currentMonth } = babyBirthDate
      ? getPostpartumProgress(babyBirthDate)
      : { weekNumber: 0, monthNumber: 0 };

    const maxMonths = tier === "pro" ? 12 : 3;

    const { data: entries, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", request.user.id)
      .is("deleted_at", null)
      .lte("month_number", maxMonths)
      .order("created_at", { ascending: false });

    if (error) {
      return reply.status(500).send({ code: "DB_ERROR", message: "Failed to fetch timeline" });
    }

    const { data: checkpoints } = await supabase
      .from("timeline_checkpoints")
      .select("*")
      .eq("user_id", request.user.id);

    const mergedCheckpoints = mergeCheckpoints(checkpoints ?? []);
    const groups = buildWeekGroups(entries ?? [], mergedCheckpoints, currentWeek);

    return reply.send({
      groups,
      totalEntries: entries?.length ?? 0,
      currentWeek,
      currentMonth,
    });
  });
}

function getPostpartumProgress(babyBirthDate: string) {
  const birth = new Date(babyBirthDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  return {
    weekNumber: Math.min(Math.floor(diffDays / 7), 52),
    monthNumber: Math.min(Math.floor(diffDays / 30), 12),
  };
}

function mergeCheckpoints(userCheckpoints: Record<string, unknown>[]) {
  return DEFAULT_CHECKPOINTS.map((def) => {
    const user = userCheckpoints.find(
      (c) =>
        (def.weekNumber !== null && c["week_number"] === def.weekNumber) ||
        (def.monthNumber !== null && c["month_number"] === def.monthNumber),
    );
    return {
      id: (user?.["id"] as string) ?? `default-${def.weekNumber ?? def.monthNumber}`,
      userId: (user?.["user_id"] as string) ?? "system",
      weekNumber: def.weekNumber,
      monthNumber: def.monthNumber,
      label: def.label,
      description: def.description,
      reachedAt: (user?.["reached_at"] as string | null) ?? null,
    };
  });
}

function buildWeekGroups(
  entries: Record<string, unknown>[],
  checkpoints: ReturnType<typeof mergeCheckpoints>,
  currentWeek: number,
) {
  const weekMap = new Map<number, Record<string, unknown>[]>();
  for (const entry of entries) {
    const week = (entry["week_number"] as number) ?? 0;
    if (!weekMap.has(week)) weekMap.set(week, []);
    weekMap.get(week)!.push(entry);
  }

  const weeks = Array.from(new Set([...weekMap.keys(), currentWeek])).sort((a, b) => b - a);

  return weeks.map((week) => {
    const checkpoint = checkpoints.find((c) => c.weekNumber === week) ?? null;
    const weekEntries = weekMap.get(week) ?? [];
    return {
      weekNumber: week,
      label: checkpoint?.label ?? `Week ${week}`,
      entries: weekEntries.map(mapEntry),
      checkpoint,
      entryCount: weekEntries.length,
    };
  });
}

function mapEntry(row: Record<string, unknown>) {
  return {
    id: row["id"],
    userId: row["user_id"],
    promptId: row["prompt_id"],
    mode: row["mode"],
    content: row["content"],
    audioFileKey: row["audio_file_key"],
    moodTags: row["mood_tags"] ?? [],
    isNightEntry: row["is_night_entry"],
    isSharedToCommunity: row["is_shared_to_community"],
    communityPostId: row["community_post_id"],
    weekNumber: row["week_number"],
    monthNumber: row["month_number"],
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
    deletedAt: row["deleted_at"],
  };
}
