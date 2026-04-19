import React from "react";
import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import type { MoodTag } from "@lumina/shared";
import { colors, radius, spacing, typography } from "../theme/tokens";

const MOOD_TAGS: MoodTag[] = [
  "grateful", "exhausted", "anxious", "joyful", "sad", "numb",
  "connected", "lonely", "overwhelmed", "proud", "angry", "hopeful",
];

interface MoodTagSelectorProps {
  selected: MoodTag[];
  onChange: (tags: MoodTag[]) => void;
  max?: number;
}

export function MoodTagSelector({ selected, onChange, max = 5 }: MoodTagSelectorProps) {
  const toggle = (tag: MoodTag) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else if (selected.length < max) {
      onChange([...selected, tag]);
    }
  };

  return (
    <View>
      <Text style={styles.label}>How are you feeling? (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {MOOD_TAGS.map((tag) => {
          const isSelected = selected.includes(tag);
          const tagColor = colors.tag[tag] ?? colors.text.secondary;
          return (
            <Pressable
              key={tag}
              style={[
                styles.tag,
                {
                  borderColor: isSelected ? tagColor : colors.border.default,
                  backgroundColor: isSelected ? `${tagColor}22` : "transparent",
                },
              ]}
              onPress={() => toggle(tag)}
            >
              <Text style={[styles.tagText, { color: isSelected ? tagColor : colors.text.muted }]}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scroll: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  tag: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
  },
  tagText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    textTransform: "capitalize",
  },
});
