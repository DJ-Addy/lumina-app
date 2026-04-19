import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CommunityPostVisibility } from "@lumina/shared";
import { communityService } from "../../src/services/community";
import { CTAButton } from "../../src/components/CTAButton";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

export default function ShareComposerScreen() {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<CommunityPostVisibility>("public");
  const queryClient = useQueryClient();

  const shareMutation = useMutation({
    mutationFn: () =>
      communityService.createPost({
        content,
        visibility,
        excerpt: content.length > 280 ? content.slice(0, 280) + "…" : content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      router.back();
    },
    onError: () => Alert.alert("Error", "Could not share your post. Please try again."),
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.privacyNotice}>
          <Text style={styles.privacyIcon}>◉</Text>
          <Text style={styles.privacyText}>
            This will appear under your anonymous alias. Your real identity is never revealed.
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="What do you want to share with other moms tonight?"
          placeholderTextColor={colors.text.muted}
          value={content}
          onChangeText={setContent}
          multiline
          autoFocus
          maxLength={1000}
        />

        <Text style={styles.charCount}>{content.length} / 1000</Text>

        <View style={styles.visibilitySection}>
          <Text style={styles.label}>Who can see this?</Text>
          <View style={styles.visibilityRow}>
            {(["public", "followers"] as CommunityPostVisibility[]).map((vis) => (
              <Pressable
                key={vis}
                style={[styles.visOption, visibility === vis && styles.visOptionActive]}
                onPress={() => setVisibility(vis)}
              >
                <Text style={[styles.visLabel, visibility === vis && styles.visLabelActive]}>
                  {vis === "public" ? "All moms" : "Followers only"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <CTAButton
            label="Cancel"
            variant="ghost"
            size="md"
            onPress={() => router.back()}
          />
          <CTAButton
            label="Share"
            size="md"
            isLoading={shareMutation.isPending}
            disabled={!content.trim()}
            onPress={() => shareMutation.mutate()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: `${colors.accent.purple}15`,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  privacyIcon: { fontSize: typography.size.md, color: colors.accent.purple, marginTop: 2 },
  privacyText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  input: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    minHeight: 180,
    lineHeight: typography.size.lg * typography.lineHeight.relaxed,
    textAlignVertical: "top",
  },
  charCount: { fontSize: typography.size.xs, color: colors.text.muted, textAlign: "right" },
  visibilitySection: { gap: spacing.sm },
  label: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  visibilityRow: { flexDirection: "row", gap: spacing.sm },
  visOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
  },
  visOptionActive: {
    borderColor: colors.accent.purple,
    backgroundColor: `${colors.accent.purple}15`,
  },
  visLabel: { fontSize: typography.size.sm, color: colors.text.muted },
  visLabelActive: { color: colors.accent.purple, fontWeight: typography.weight.semibold },
  actions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
});
