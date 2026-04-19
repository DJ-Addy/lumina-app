import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  isDemoMode: boolean;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  enableDemoMode: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isDemoMode: false,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user ?? null, isDemoMode: false, isLoading: false }),
  enableDemoMode: () => set({ session: null, user: null, isDemoMode: true, isLoading: false }),
  signOut: async () => {
    if (hasSupabaseConfig) {
      await supabase.auth.signOut();
    }
    set({ session: null, user: null, isDemoMode: false });
  },
}));
