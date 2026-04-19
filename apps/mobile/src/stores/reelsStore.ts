import { create } from "zustand";

export const REELS_PER_MINDFULNESS_BREAK = 25;

interface ReelsState {
  watchedThisSession: number;
  lastBreakAt: number; // count at which last break was triggered
  recordWatch: () => { shouldShowMindfulness: boolean };
  acknowledgeBreak: () => void;
  reset: () => void;
}

export const useReelsStore = create<ReelsState>((set, get) => ({
  watchedThisSession: 0,
  lastBreakAt: 0,
  recordWatch: () => {
    const next = get().watchedThisSession + 1;
    const shouldShow =
      next - get().lastBreakAt >= REELS_PER_MINDFULNESS_BREAK;
    set({ watchedThisSession: next });
    return { shouldShowMindfulness: shouldShow };
  },
  acknowledgeBreak: () => set({ lastBreakAt: get().watchedThisSession }),
  reset: () => set({ watchedThisSession: 0, lastBreakAt: 0 }),
}));
