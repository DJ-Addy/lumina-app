import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  CreateJournalEntryRequest,
  JournalEntry,
  JournalEntriesResponse,
  JournalSaveResponse,
  TimelineResponse,
  TimelineWeekGroup,
} from "@lumina/shared";

const STORAGE_KEY = "@lumina/demo-journal-entries";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

let cache: JournalEntry[] | null = null;

async function loadAll(): Promise<JournalEntry[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as JournalEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

async function persist(entries: JournalEntry[]): Promise<void> {
  cache = entries;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore — best-effort
  }
}

function uuid(): string {
  // Lightweight v4-ish uuid (good enough for demo, not crypto-strong)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function weekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = (date.getTime() - start.getTime()) / 86400000;
  return Math.max(1, Math.ceil((diff + start.getDay() + 1) / 7));
}

export const demoJournalStore = {
  async createEntry(input: CreateJournalEntryRequest): Promise<JournalSaveResponse> {
    const entries = await loadAll();
    const now = new Date();
    const entry: JournalEntry = {
      id: uuid(),
      userId: DEMO_USER_ID,
      promptId: input.promptId ?? null,
      mode: input.mode,
      content: input.content,
      audioFileKey: null,
      moodTags: input.moodTags ?? [],
      isNightEntry: input.isNightEntry ?? false,
      isSharedToCommunity: false,
      communityPostId: null,
      weekNumber: weekOfYear(now),
      monthNumber: now.getMonth() + 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
    };
    await persist([entry, ...entries]);
    return { entry };
  },

  async getEntries(): Promise<JournalEntriesResponse> {
    const entries = await loadAll();
    return {
      entries,
      total: entries.length,
      page: 1,
      pageSize: entries.length,
    };
  },

  async getEntry(id: string): Promise<{ entry: JournalEntry }> {
    const entries = await loadAll();
    const entry = entries.find((e) => e.id === id);
    if (!entry) throw new Error("Entry not found");
    return { entry };
  },

  async deleteEntry(id: string): Promise<void> {
    const entries = await loadAll();
    await persist(entries.filter((e) => e.id !== id));
  },

  async getTimeline(): Promise<TimelineResponse> {
    const entries = await loadAll();
    const groups = new Map<number, JournalEntry[]>();
    for (const e of entries) {
      const list = groups.get(e.weekNumber) ?? [];
      list.push(e);
      groups.set(e.weekNumber, list);
    }

    const timelineGroups: TimelineWeekGroup[] = Array.from(groups.entries())
      .sort(([a], [b]) => b - a)
      .map(([weekNumber, weekEntries]) => ({
        weekNumber,
        label: `Week ${weekNumber}`,
        entries: weekEntries,
        entryCount: weekEntries.length,
        checkpoint: null,
      }));

    const now = new Date();
    return {
      currentWeek: weekOfYear(now),
      currentMonth: now.getMonth() + 1,
      totalEntries: entries.length,
      groups: timelineGroups,
    };
  },

  async clear(): Promise<void> {
    await persist([]);
  },
};
