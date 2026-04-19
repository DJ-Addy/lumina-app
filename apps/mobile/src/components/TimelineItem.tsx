import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import type { JournalEntry } from "@lumina/shared";
import { colors, spacing, typography, radius } from "../theme/tokens";

interface TimelineItemProps {
  entry: JournalEntry;
  onPress?: (entry: JournalEntry) => void;
}

const MODE_ICONS: Record<string, string> = {
  text: "✍",
  voice: "🎤",
  micro: "✦",
  letter: "💌",
};

export function TimelineItem({ entry, onPress }: TimelineItemProps) {
  const time = new Date(entry.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const preview =
    entry.content.length > 120 ? entry.content.slice(0, 120) + "…" : entry.content;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.8 }]}
      onPress={() => onPress?.(entry)}
    >
      <View style={styles.dotColumn}>
        <View style={styles.dot} />
        <View style={styles.line} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.modeIcon}>{MODE_ICONS[entry.mode] ?? "✍"}</Text>
          <Text style={styles.time}>{time}</Text>
          {entry.isNightEntry && <Text style={styles.nightBadge}>✦ night</Text>}
        </View>
        <Text style={styles.preview}>{preview}</Text>
        {entry.moodTags.length > 0 && (
          <View style={styles.tags}>
            {entry.moodTags.slice(0, 3).map((tag) => (
              <Text key={tag} style={[styles.tag, { color: colors.tag[tag as keyof typeof colors.tag] ?? colors.text.muted }]}>
                {tag}
              </Text>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
  },
  dotColumn: {
    width: 24,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent.purple,
    marginTop: 4,
  },
  line: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border.subtle,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    marginLeft: spacing.sm,
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  modeIcon: { fontSize: typography.size.sm },
  time: { fontSize: typography.size.xs, color: colors.text.muted },
  nightBadge: {
    fontSize: typography.size.xs,
    color: colors.night.accent,
    marginLeft: "auto",
  },
  preview: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  tags: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: "wrap",
  },
  tag: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    textTransform: "capitalize",
  },
});
