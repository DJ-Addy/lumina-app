import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CosmicCard as CosmicCardType } from "@lumina/shared";
import { GlassCard } from "./GlassCard";
import { colors, spacing, typography } from "../theme/tokens";

export function CosmicCard({ card }: { card: CosmicCardType }) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.star}>✦</Text>
        <Text style={styles.label}>Cosmic Context</Text>
        <Text style={styles.date}>
          {new Date(card.date).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </Text>
      </View>
      <View style={styles.moonRow}>
        <Text style={styles.moonPhase}>{card.moonPhase}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.moonSign}>{card.moonSign} Moon</Text>
      </View>
      <Text style={styles.context}>{card.dailyContext}</Text>
      {card.momBabyInsight && (
        <View style={styles.insight}>
          <Text style={styles.insightLabel}>You + Baby</Text>
          <Text style={styles.insightText}>{card.momBabyInsight}</Text>
        </View>
      )}
      {card.journalPromptSuggestion && (
        <View style={styles.suggestion}>
          <Text style={styles.suggestionLabel}>Tonight's prompt</Text>
          <Text style={styles.suggestionText}>{card.journalPromptSuggestion}</Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  star: { color: colors.accent.yellow, fontSize: typography.size.md },
  label: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: typography.weight.semibold,
  },
  date: { fontSize: typography.size.xs, color: colors.text.muted },
  moonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  moonPhase: {
    fontSize: typography.size.md,
    color: colors.accent.yellow,
    fontWeight: typography.weight.semibold,
  },
  dot: { color: colors.text.muted },
  moonSign: { fontSize: typography.size.md, color: colors.accent.aqua },
  context: {
    fontSize: typography.size.md,
    color: colors.text.primary,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    marginBottom: spacing.md,
  },
  insight: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  insightLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  insightText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  suggestion: {
    backgroundColor: `${colors.accent.purple}15`,
    borderRadius: 8,
    padding: spacing.sm,
  },
  suggestionLabel: {
    fontSize: typography.size.xs,
    color: colors.accent.purple,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontStyle: "italic",
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
});
