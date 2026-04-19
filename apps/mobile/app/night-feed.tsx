import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { nightModeService } from "../src/services/nightMode";
import { CTAButton } from "../src/components/CTAButton";
import { GlassCard } from "../src/components/GlassCard";
import { colors, spacing, typography } from "../src/theme/tokens";
import type { NightFeedItem } from "@lumina/shared";

export default function NightFeedScreen() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["night-feed"],
    queryFn: nightModeService.getFeed,
    refetchInterval: 60000,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.time}>{getCurrentTimeLabel()}</Text>
        <Text style={styles.headline}>You are not alone.</Text>
        {data?.activeMomsCount ? (
          <Text style={styles.countLabel}>
            {data.activeMomsCount} moms are journaling right now
          </Text>
        ) : null}
      </View>

      <FlatList<NightFeedItem>
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GlassCard variant="night" style={styles.feedItem}>
            <Text style={styles.timestamp}>{item.timestampLabel}</Text>
            <Text style={styles.snippet}>{item.snippet}</Text>
          </GlassCard>
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.night.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Be the first to write tonight. Someone out there needs to know they're not alone.
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        {data?.prompt && <Text style={styles.footerPrompt}>{data.prompt}</Text>}
        <CTAButton
          label="Write now"
          size="md"
          onPress={() => router.push("/journal/compose?mode=micro")}
        />
      </View>
    </SafeAreaView>
  );
}

function getCurrentTimeLabel(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night.background },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  time: {
    fontSize: typography.size.xxl,
    color: colors.night.text,
    fontWeight: typography.weight.bold,
    letterSpacing: 2,
  },
  headline: {
    fontSize: typography.size.lg,
    color: colors.night.accent,
    fontStyle: "italic",
  },
  countLabel: {
    fontSize: typography.size.sm,
    color: colors.night.accent,
    opacity: 0.7,
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: 140 },
  feedItem: { padding: spacing.md },
  timestamp: {
    fontSize: typography.size.xs,
    color: colors.night.accent,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  snippet: {
    fontSize: typography.size.md,
    color: colors.night.text,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    fontStyle: "italic",
  },
  empty: {
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: typography.size.md,
    color: colors.night.text,
    textAlign: "center",
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    fontStyle: "italic",
    opacity: 0.7,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.night.background,
    borderTopWidth: 1,
    borderTopColor: `${colors.night.accent}20`,
    gap: spacing.sm,
    alignItems: "stretch",
  },
  footerPrompt: {
    fontSize: typography.size.sm,
    color: colors.night.text,
    textAlign: "center",
    fontStyle: "italic",
    opacity: 0.7,
  },
});
