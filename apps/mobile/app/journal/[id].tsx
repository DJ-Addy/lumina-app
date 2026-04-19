import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { journalService } from "../../src/services/journal";
import { communityService } from "../../src/services/community";
import { CTAButton } from "../../src/components/CTAButton";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

export default function JournalEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["journal-entry", id],
    queryFn: () => journalService.getEntry(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => journalService.deleteEntry(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      router.back();
    },
  });

  const shareMutation = useMutation({
    mutationFn: () =>
      communityService.createPost({
        content: data!.entry.content,
        excerpt:
          data!.entry.content.length > 280
            ? data!.entry.content.slice(0, 280) + "…"
            : data!.entry.content,
        journalEntryId: id,
        visibility: "public",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entry", id] });
      Alert.alert("Shared", "Your entry is now visible in the community feed.");
    },
    onError: () => Alert.alert("Error", "Could not share this entry."),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.accent.purple} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const { entry } = data;
  const createdAt = new Date(entry.createdAt);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.meta}>
          <Text style={styles.date}>
            {createdAt.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
          <Text style={styles.time}>
            {createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </Text>
          <View style={styles.badges}>
            <Text style={styles.badge}>{entry.mode}</Text>
            {entry.isNightEntry && <Text style={[styles.badge, styles.nightBadge]}>🌙 night</Text>}
            {entry.isSharedToCommunity && <Text style={[styles.badge, styles.sharedBadge]}>✦ shared</Text>}
          </View>
        </View>

        <Text style={styles.content}>{entry.content}</Text>

        {entry.moodTags.length > 0 && (
          <View style={styles.tagsRow}>
            {entry.moodTags.map((tag) => (
              <Text
                key={tag}
                style={[
                  styles.tag,
                  { color: colors.tag[tag as keyof typeof colors.tag] ?? colors.text.muted },
                ]}
              >
                {tag}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {!entry.isSharedToCommunity && (
            <CTAButton
              label="Share to Community"
              variant="secondary"
              size="md"
              isLoading={shareMutation.isPending}
              onPress={() =>
                Alert.alert(
                  "Share to community?",
                  "This will post anonymously under your community alias. Your real identity is never revealed.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Share", onPress: () => shareMutation.mutate() },
                  ],
                )
              }
            />
          )}
          <CTAButton
            label="Delete Entry"
            variant="ghost"
            size="md"
            isLoading={deleteMutation.isPending}
            onPress={() =>
              Alert.alert("Delete this entry?", "This cannot be undone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
              ])
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  meta: { gap: spacing.xs },
  date: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  time: { fontSize: typography.size.sm, color: colors.text.muted },
  badges: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  badge: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textTransform: "capitalize",
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  nightBadge: { borderColor: `${colors.night.accent}40`, color: colors.night.accent },
  sharedBadge: { borderColor: `${colors.accent.purple}40`, color: colors.accent.purple },
  content: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    lineHeight: typography.size.lg * typography.lineHeight.relaxed,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    textTransform: "capitalize",
  },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
