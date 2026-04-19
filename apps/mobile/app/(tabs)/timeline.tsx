import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { timelineService } from "../../src/services/timeline";
import { TimelineItem } from "../../src/components/TimelineItem";
import type { JournalEntry } from "@lumina/shared";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

export default function TimelineScreen() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["timeline"],
    queryFn: timelineService.getTimeline,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.accent.purple} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.accent.purple}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Journey</Text>
          <Text style={styles.meta}>
            Week {data?.currentWeek ?? 0} · {data?.totalEntries ?? 0} entries
          </Text>
        </View>

        {(!data || data.totalEntries === 0) && (
          <View style={styles.empty}>
            <Text style={styles.emptyStar}>✦</Text>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Your journal lives here. Start with a single sentence, a voice note, or a chat with Lumina.
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
                onPress={() => router.push("/journal/compose?mode=text")}
              >
                <Text style={styles.ctaLabel}>Write an entry</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.85 }]}
                onPress={() => router.push("/journal/chat")}
              >
                <Text style={styles.ctaSecondaryLabel}>Talk with Lumina</Text>
              </Pressable>
            </View>
          </View>
        )}

        {data?.groups.map((group) => (
          <View key={group.weekNumber} style={styles.weekGroup}>
            {group.checkpoint && (
              <View style={styles.checkpoint}>
                <Text style={styles.checkpointStar}>✦</Text>
                <Text style={styles.checkpointLabel}>{group.checkpoint.label}</Text>
                <Text style={styles.checkpointDesc}>{group.checkpoint.description}</Text>
              </View>
            )}

            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>{group.label}</Text>
              <Text style={styles.weekCount}>{group.entryCount} entries</Text>
            </View>

            {group.entries.length === 0 ? (
              <Text style={styles.emptyWeek}>Nothing written this week</Text>
            ) : (
              <View style={styles.entries}>
                {group.entries.map((entry) => (
                  <TimelineItem
                    key={entry.id}
                    entry={entry}
                    onPress={(e: JournalEntry) => router.push(`/journal/${e.id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  header: { gap: spacing.xs, marginBottom: spacing.md },
  title: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  meta: { fontSize: typography.size.sm, color: colors.text.muted },
  weekGroup: { gap: spacing.md },
  checkpoint: {
    backgroundColor: `${colors.accent.rose}15`,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.accent.rose}30`,
    gap: spacing.xs,
  },
  checkpointStar: { fontSize: typography.size.lg, color: colors.accent.rose },
  checkpointLabel: {
    fontSize: typography.size.lg,
    color: colors.accent.rose,
    fontWeight: typography.weight.semibold,
  },
  checkpointDesc: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekLabel: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  weekCount: { fontSize: typography.size.xs, color: colors.text.muted },
  emptyWeek: { fontSize: typography.size.sm, color: colors.text.muted, fontStyle: "italic" },
  entries: { gap: spacing.xs },
  empty: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyStar: {
    fontSize: typography.size.display,
    color: colors.accent.rose,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  emptyBody: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    maxWidth: 320,
  },
  emptyActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cta: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  ctaLabel: {
    color: colors.text.inverse,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.md,
  },
  ctaSecondary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent.purple,
  },
  ctaSecondaryLabel: {
    color: colors.accent.purple,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.md,
  },
});
