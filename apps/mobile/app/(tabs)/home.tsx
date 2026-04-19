import React, { useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable } from "react-native";
import { PromptCard } from "../../src/components/PromptCard";
import { SummaryCard } from "../../src/components/SummaryCard";
import { CosmicCard } from "../../src/components/CosmicCard";
import { promptService } from "../../src/services/prompts";
import { summaryService } from "../../src/services/summaries";
import { astrologyService } from "../../src/services/astrology";
import { useUIStore } from "../../src/store/ui";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { NightFeedBanner } from "../../src/components/NightFeedBanner";

export default function HomeScreen() {
  const isNightMode = useUIStore((s) => s.isNightMode);
  const checkAndSetNightMode = useUIStore((s) => s.checkAndSetNightMode);

  useEffect(() => {
    checkAndSetNightMode();
    const interval = setInterval(checkAndSetNightMode, 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAndSetNightMode]);

  const bg = isNightMode ? colors.night.background : colors.background.primary;

  const promptQuery = useQuery({
    queryKey: ["prompt-today"],
    queryFn: promptService.getTodayPrompt,
  });

  const summaryQuery = useQuery({
    queryKey: ["summary-latest"],
    queryFn: summaryService.getLatest,
  });

  const cosmicQuery = useQuery({
    queryKey: ["cosmic-card"],
    queryFn: astrologyService.getCosmicCard,
  });

  const isRefreshing = promptQuery.isFetching && !promptQuery.isLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              promptQuery.refetch();
              summaryQuery.refetch();
            }}
            tintColor={colors.accent.purple}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.greeting, isNightMode && { color: colors.night.text }]}>
            {getGreeting()}
          </Text>
          <Text style={styles.star}>✦</Text>
        </View>

        {isNightMode && <NightFeedBanner />}

        <Pressable
          onPress={() => router.push("/journal/chat")}
          style={({ pressed }) => [styles.chatCta, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.chatCtaInner}>
            <Text style={styles.chatCtaIcon}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatCtaTitle}>Talk with Lumina</Text>
              <Text style={styles.chatCtaSub}>
                A gentle conversation. She'll listen first.
              </Text>
            </View>
            <Text style={styles.chatCtaArrow}>→</Text>
          </View>
        </Pressable>

        {promptQuery.data && (
          <PromptCard
            data={promptQuery.data}
            onJournalPress={() => router.push("/journal/compose?mode=text")}
            onVoicePress={() => router.push("/journal/compose?mode=voice")}
            onMicroPress={() => router.push("/journal/compose?mode=micro")}
          />
        )}

        {cosmicQuery.data && (
          <View style={styles.section}>
            <CosmicCard card={cosmicQuery.data} />
          </View>
        )}

        {summaryQuery.data && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your week, reflected</Text>
            <SummaryCard summary={summaryQuery.data.summary} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 5) return "You're up. You're here.";
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "How are you, really?";
  return "Good evening.";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingVertical: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  star: { fontSize: typography.size.xl, color: colors.accent.rose },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    fontWeight: typography.weight.semibold,
  },
  chatCta: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: `${colors.accent.purple}25`,
    borderWidth: 1,
    borderColor: `${colors.accent.purple}55`,
    overflow: "hidden",
  },
  chatCtaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  chatCtaIcon: {
    fontSize: typography.size.xxl,
    color: colors.accent.rose,
  },
  chatCtaTitle: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  chatCtaSub: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  chatCtaArrow: {
    fontSize: typography.size.xl,
    color: colors.accent.purple,
  },
});
