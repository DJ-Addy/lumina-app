import type {
  CreateJournalEntryRequest,
  JournalEntriesResponse,
  JournalEntry,
  JournalQueryParams,
  JournalSaveResponse,
  UpdateJournalEntryRequest,
  VoiceTranscribeRequest,
  VoiceTranscribeResponse,
} from "@lumina/shared";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import { hasSupabaseConfig } from "../lib/supabase";
import { demoJournalStore } from "./demoStore";

export const journalService = {
  getEntries: (params?: Partial<JournalQueryParams>): Promise<JournalEntriesResponse> => {
    if (!hasSupabaseConfig) return demoJournalStore.getEntries();
    const qs = params
      ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : "";
    return apiGet<JournalEntriesResponse>(`/v1/journal/entries${qs}`);
  },

  getEntry: (id: string): Promise<{ entry: JournalEntry }> => {
    if (!hasSupabaseConfig) return demoJournalStore.getEntry(id);
    return apiGet<{ entry: JournalEntry }>(`/v1/journal/entries/${id}`);
  },

  createEntry: (data: CreateJournalEntryRequest): Promise<JournalSaveResponse> => {
    if (!hasSupabaseConfig) return demoJournalStore.createEntry(data);
    return apiPost<JournalSaveResponse>("/v1/journal/entries", data);
  },

  updateEntry: (id: string, data: UpdateJournalEntryRequest) =>
    apiPatch<JournalSaveResponse>(`/v1/journal/entries/${id}`, data),

  deleteEntry: (id: string): Promise<void> => {
    if (!hasSupabaseConfig) return demoJournalStore.deleteEntry(id);
    return apiDelete(`/v1/journal/entries/${id}`);
  },

  transcribeVoice: (data: VoiceTranscribeRequest) =>
    apiPost<VoiceTranscribeResponse>("/v1/journal/voice/transcribe", data),
};
