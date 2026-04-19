import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Summary } from "@lumina/shared";
import { GlassCard } from "./GlassCard";
import { colors, spacing, typography } from "../theme/tokens";

interface SummaryCardProps {
  summary: Summary;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const topEmotions = Object.entries(summary.emotionWordCloud)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.star}>✦</Text>
        <Text style={styles.periodLabel}>
          {new Date(summary.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" — "}
          {new Date(summary.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Text>
        <Text style={styles.cadenceBadge}>{summary.cadence}</Text>
      </View>

      <Text style={styles.narrative}>{summary.narrativeText}</Text>

      {summary.affirmation && (
        <View style={styles.affirmationBox}>
          <Text style={styles.affirmation}>"{summary.affirmation}"</Text>
        </View>
      )}

      {topEmotions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>This week you felt</Text>
          <View style={styles.emotionRow}>
            {topEmotions.map(([word, count]) => (
              <View key={word} style={styles.emotionTag}>
                <Text style={styles.emotionWord}>{word}</Text>
                <Text style={styles.emotionCount}>×{count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {summary.highlights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Moments that stood out</Text>
          {summary.highlights.map((h, i) => (
            <Text key={i} style={styles.highlight}>· {h}</Text>
          ))}
        </View>
      )}

      <Text style={styles.entryCount}>{summary.entryCount} entries</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  star: { color: colors.accent.rose, fontSize: typography.size.md },
  periodLabel: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.muted,
    fontWeight: typography.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cadenceBadge: {
    fontSize: typography.size.xs,
    color: colors.accent.purple,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: typography.weight.semibold,
  },
  narrative: {
    fontSize: typography.size.md,
    color: colors.text.primary,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    marginBottom: spacing.md,
  },
  affirmationBox: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent.rose,
    paddingLeft: spacing.sm,
    marginBottom: spacing.md,
  },
  affirmation: {
    fontSize: typography.size.md,
    color: colors.accent.rose,
    fontStyle: "italic",
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
  },
  section: { marginBottom: spacing.md },
  sectionLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emotionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  emotionTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.background.cardHover,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  emotionWord: { fontSize: typography.size.sm, color: colors.text.secondary, textTransform: "capitalize" },
  emotionCount: { fontSize: typography.size.xs, color: colors.text.muted },
  highlight: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * 1.8,
  },
  entryCount: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textAlign: "right",
    marginTop: spacing.sm,
  },
});
