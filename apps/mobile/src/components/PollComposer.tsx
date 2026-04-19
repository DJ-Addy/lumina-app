import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

export interface DraftPoll {
  question: string;
  options: string[];
  endsInHours?: number;
}

interface Props {
  value: DraftPoll;
  onChange: (next: DraftPoll) => void;
}

const DURATION_PRESETS: Array<{ label: string; hours: number | undefined }> = [
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "Open forever", hours: undefined },
];

export function PollComposer({ value, onChange }: Props) {
  function setQuestion(question: string) {
    onChange({ ...value, question });
  }
  function setOption(i: number, label: string) {
    const next = [...value.options];
    next[i] = label;
    onChange({ ...value, options: next });
  }
  function addOption() {
    if (value.options.length >= 4) return;
    onChange({ ...value, options: [...value.options, ""] });
  }
  function removeOption(i: number) {
    if (value.options.length <= 2) return;
    const next = value.options.filter((_, idx) => idx !== i);
    onChange({ ...value, options: next });
  }
  function setDuration(hours: number | undefined) {
    onChange({ ...value, endsInHours: hours });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Question</Text>
      <TextInput
        style={styles.questionInput}
        placeholder="Ask the community something…"
        placeholderTextColor={colors.text.muted}
        value={value.question}
        onChangeText={setQuestion}
        maxLength={200}
        multiline
      />

      <Text style={styles.label}>Options</Text>
      <View style={{ gap: spacing.sm }}>
        {value.options.map((opt, i) => (
          <View key={i} style={styles.optionRow}>
            <TextInput
              style={styles.optionInput}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={colors.text.muted}
              value={opt}
              onChangeText={(t) => setOption(i, t)}
              maxLength={80}
            />
            {value.options.length > 2 && (
              <Pressable onPress={() => removeOption(i)} style={styles.removeBtn}>
                <Text style={styles.removeBtnLabel}>×</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {value.options.length < 4 && (
        <Pressable onPress={addOption} style={styles.addOptionBtn}>
          <Text style={styles.addOptionLabel}>+ Add option</Text>
        </Pressable>
      )}

      <Text style={styles.label}>Duration</Text>
      <View style={styles.durationRow}>
        {DURATION_PRESETS.map((d) => {
          const selected = value.endsInHours === d.hours;
          return (
            <Pressable
              key={d.label}
              style={[styles.durationChip, selected && styles.durationChipSelected]}
              onPress={() => setDuration(d.hours)}
            >
              <Text style={[styles.durationLabel, selected && styles.durationLabelSelected]}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function isValidPoll(p: DraftPoll): boolean {
  if (!p.question.trim()) return false;
  const filled = p.options.filter((o) => o.trim());
  return filled.length >= 2;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  questionInput: {
    fontSize: typography.size.md,
    color: colors.text.primary,
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 60,
    textAlignVertical: "top",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionInput: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.primary,
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.background.card,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xl,
    lineHeight: typography.size.xl,
  },
  addOptionBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
  },
  addOptionLabel: {
    color: colors.accent.purple,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  durationChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  durationChipSelected: {
    borderColor: colors.accent.purple,
    backgroundColor: `${colors.accent.purple}20`,
  },
  durationLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
  },
  durationLabelSelected: {
    color: colors.accent.purple,
    fontWeight: typography.weight.semibold,
  },
});
