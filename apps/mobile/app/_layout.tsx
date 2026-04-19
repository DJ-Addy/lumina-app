import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { hasSupabaseConfig, supabase } from "../src/lib/supabase";
import { useAuthStore } from "../src/store/auth";
import { initPurchases, logoutPurchases } from "../src/lib/purchases";
import { colors } from "../src/theme/tokens";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    void initPurchases();
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user.id) void initPurchases(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user.id) {
        void initPurchases(session.user.id);
      } else {
        void logoutPurchases();
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" backgroundColor={colors.background.primary} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background.primary },
          headerTintColor: colors.text.primary,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.background.primary },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="journal/compose" options={{ title: "New Entry", presentation: "modal" }} />
        <Stack.Screen
          name="journal/chat"
          options={{ title: "Talk with Lumina", presentation: "modal", headerShown: false }}
        />
        <Stack.Screen name="journal/[id]" options={{ title: "Entry" }} />
        <Stack.Screen name="community/post/[id]" options={{ title: "Post" }} />
      </Stack>
    </QueryClientProvider>
  );
}
