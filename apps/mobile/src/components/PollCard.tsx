import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import type { CommunityPoll } from "@lumina/shared";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { communityService } from "../services/community";

interface Props {
  poll: CommunityPoll;
  onChange?: () => void;
}

export function PollCard({ poll, onChange }: Props) {
  const [voteState, setVoteState] = useState<{
    selected: string | null;
    counts: Record<string, number>;
    total: number;
  }>({
    selected: poll.viewerVote ?? null,
    counts: poll.voteCounts,
    total: poll.totalVotes,
  });
  const [busy, setBusy] = useState(false);

  const isClosed = useMemo(
    () => poll.endsAt && new Date(poll.endsAt).getTime() < Date.now(),
    [poll.endsAt],
  );
  const showResults = !!voteState.selected || isClosed;

  async function vote(optionId: string) {
    if (busy || isClosed) return;
    setBusy(true);
    const wasSelected = voteState.selected;
    // Optimistic update
    setVoteState((prev) => {
      const counts = { ...prev.counts };
      if (wasSelected && wasSelected !== optionId) {
        counts[wasSelected] = Math.max(0, (counts[wasSelected] ?? 0) - 1);
      }
      counts[optionId] = (counts[optionId] ?? 0) + 1;
      const total = wasSelected ? prev.total : prev.total + 1;
      return { selected: optionId, counts, total };
    });
    try {
      await communityService.votePoll(poll.id, { optionId });
      onChange?.();
    } catch {
      // revert on failure
      setVoteState({
        selected: poll.viewerVote ?? null,
        counts: poll.voteCounts,
        total: poll.totalVotes,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{poll.question}</Text>
      <View style={styles.options}>
        {poll.options.map((opt) => {
          const count = voteState.counts[opt.id] ?? 0;
          const ratio = voteState.total > 0 ? count / voteState.total : 0;
          const selected = voteState.selected === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => vote(opt.id)}
              disabled={isClosed || busy}
              style={[styles.option, selected && styles.optionSelected]}
            >
              {showResults && (
                <View
                  style={[styles.resultBar, { width: `${Math.round(ratio * 100)}%` }]}
                />
              )}
              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                {showResults && (
                  <Text style={[styles.optionPct, selected && styles.optionLabelSelected]}>
                    {Math.round(ratio * 100)}%
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.meta}>
        {voteState.total} {voteState.total === 1 ? "vote" : "votes"}
        {isClosed ? " · closed" : poll.endsAt ? ` · ends ${new Date(poll.endsAt).toLocaleString()}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  question: {
    fontSize: typography.size.md,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
  },
  options: {
    gap: spacing.xs,
  },
  option: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  optionSelected: {
    borderColor: colors.accent.purple,
  },
  resultBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: `${colors.accent.purple}30`,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  optionLabelSelected: {
    color: colors.accent.purple,
    fontWeight: typography.weight.semibold,
  },
  optionPct: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginLeft: spacing.sm,
  },
  meta: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
  },
});
