import { create } from "zustand";

interface UIState {
  isNightMode: boolean;
  setNightMode: (value: boolean) => void;
  checkAndSetNightMode: () => void;
}

function isNightHour(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 5;
}

export const useUIStore = create<UIState>((set) => ({
  isNightMode: isNightHour(),
  setNightMode: (value) => set({ isNightMode: value }),
  checkAndSetNightMode: () => set({ isNightMode: isNightHour() }),
}));
