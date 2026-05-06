import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MoodTag, JournalEntryMode } from "@lumina/shared";
import { journalService } from "../../src/services/journal";
import { alertJournalCrisisIfNeeded } from "../../src/lib/journalCrisis";
import { CTAButton } from "../../src/components/CTAButton";
import { MoodTagSelector } from "../../src/components/MoodTagSelector";
import { useUIStore } from "../../src/store/ui";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

export default function ComposeScreen() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode = (modeParam ?? "text") as JournalEntryMode;
  const isNightMode = useUIStore((s) => s.isNightMode);

  const [content, setContent] = useState("");
  const [moodTags, setMoodTags] = useState<MoodTag[]>([]);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      journalService.createEntry({
        mode,
        content,
        moodTags,
        isNightEntry: isNightMode,
      }),
    onSuccess: (data) => {
      alertJournalCrisisIfNeeded(data);
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      router.back();
    },
    onError: () => {
      Alert.alert("Couldn't save", "Something went wrong. Please try again.");
    },
  });

  const placeholder =
    mode === "micro"
      ? "One word, one sentence, one emoji. That's enough."
      : mode === "voice"
      ? "Voice recording (tap mic to record)"
      : "What's on your mind tonight?";

  const maxLength = mode === "micro" ? 140 : 10000;

  return (
    <SafeAreaView
      style={[styles.container, isNightMode && { backgroundColor: colors.night.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {isNightMode && (
            <Text style={styles.nightLabel}>🌙 Night entry</Text>
          )}

          <TextInput
            style={[
              styles.input,
              mode === "micro" && styles.microInput,
              isNightMode && { color: colors.night.text },
            ]}
            placeholder={placeholder}
            placeholderTextColor={isNightMode ? `${colors.night.text}50` : colors.text.muted}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            maxLength={maxLength}
            textAlignVertical="top"
          />

          {mode === "micro" && (
            <Text style={styles.charCount}>{content.length} / {maxLength}</Text>
          )}

          <MoodTagSelector selected={moodTags} onChange={setMoodTags} />
        </ScrollView>

        <View
          style={[styles.footer, isNightMode && { backgroundColor: colors.night.background }]}
        >
          <CTAButton
            label="Cancel"
            variant="ghost"
            size="md"
            onPress={() => router.back()}
          />
          <CTAButton
            label="Save Entry"
            size="md"
            isLoading={createMutation.isPending}
            disabled={!content.trim()}
            onPress={() => createMutation.mutate()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  nightLabel: {
    fontSize: typography.size.sm,
    color: colors.night.accent,
    fontWeight: typography.weight.medium,
  },
  input: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    minHeight: 200,
    lineHeight: typography.size.lg * typography.lineHeight.relaxed,
  },
  microInput: {
    fontSize: typography.size.xxl,
    minHeight: 80,
    textAlign: "center",
  },
  charCount: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textAlign: "right",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
});
