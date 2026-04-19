import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";

const NIGHT_PROMPTS = [
  "You're awake again. Write one sentence about right now.",
  "What does this quiet feel like tonight?",
  "One word for how you feel in this moment.",
  "You made it through another night. How are you, really?",
  "What do you need right now that you haven't gotten?",
];

export async function nightRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/feed", async (_request, reply) => {
    const { data: recentNightEntries } = await supabase
      .from("journal_entries")
      .select("id, content, created_at")
      .eq("is_night_entry", true)
      .eq("is_shared_to_community", true)
      .is("deleted_at", null)
      .gte("created_at", new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20);

    const { count: activeMoms } = await supabase
      .from("journal_entries")
      .select("user_id", { count: "exact", head: true })
      .eq("is_night_entry", true)
      .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

    const items = (recentNightEntries ?? []).map((entry) => ({
      id: entry["id"] as string,
      snippet: truncateSnippet((entry["content"] as string) ?? ""),
      timestampLabel: formatNightTimestamp(entry["created_at"] as string),
      reactionCount: 0,
    }));

    const promptIndex = new Date().getMinutes() % NIGHT_PROMPTS.length;

    return reply.send({
      items,
      activeMomsCount: activeMoms ?? 0,
      prompt: NIGHT_PROMPTS[promptIndex] ?? NIGHT_PROMPTS[0],
    });
  });
}

function truncateSnippet(text: string, maxLen = 140): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

function formatNightTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
