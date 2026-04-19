import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import type { TodayPromptResponse } from "@lumina/shared";
import { GlassCard } from "./GlassCard";
import { colors, typography, spacing } from "../theme/tokens";

interface PromptCardProps {
  data: TodayPromptResponse;
  onJournalPress: () => void;
  onVoicePress: () => void;
  onMicroPress: () => void;
}

export function PromptCard({ data, onJournalPress, onVoicePress, onMicroPress }: PromptCardProps) {
  return (
    <GlassCard style={styles.card}>
      {data.cosmicContext && (
        <Text style={styles.cosmicContext}>{data.cosmicContext}</Text>
      )}
      {data.moonPhase && (
        <View style={styles.moonRow}>
          <Text style={styles.moonIcon}>◉</Text>
          <Text style={styles.moonPhase}>{data.moonPhase}</Text>
        </View>
      )}
      <Text style={styles.promptText}>{data.prompt.text}</Text>
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={onJournalPress}>
          <Text style={styles.actionIcon}>✍</Text>
          <Text style={styles.actionLabel}>Write</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onVoicePress}>
          <Text style={styles.actionIcon}>🎤</Text>
          <Text style={styles.actionLabel}>Voice</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onMicroPress}>
          <Text style={styles.actionIcon}>✦</Text>
          <Text style={styles.actionLabel}>Micro</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
  },
  cosmicContext: {
    fontSize: typography.size.sm,
    color: colors.accent.aqua,
    marginBottom: spacing.sm,
    fontStyle: "italic",
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  moonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  moonIcon: {
    fontSize: typography.size.sm,
    color: colors.accent.yellow,
  },
  moonPhase: {
    fontSize: typography.size.sm,
    color: colors.accent.yellow,
    fontWeight: typography.weight.medium,
  },
  promptText: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    lineHeight: typography.size.xl * typography.lineHeight.relaxed,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.md,
  },
  actionBtn: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  actionIcon: {
    fontSize: typography.size.xl,
  },
  actionLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    fontWeight: typography.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
