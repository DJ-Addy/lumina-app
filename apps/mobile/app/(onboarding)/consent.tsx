import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView } from "react-native";
import { router } from "expo-router";
import { CTAButton } from "../../src/components/CTAButton";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

const CONSENT_ITEMS = [
  {
    icon: "🔒",
    title: "Your words are private",
    body: "All journal entries are encrypted. We will never read, sell, or share your emotional data.",
  },
  {
    icon: "✦",
    title: "Community is always optional",
    body: "Sharing to the community is opt-in, per post. Your journal is always private by default.",
  },
  {
    icon: "🌙",
    title: "AI is a mirror, not a doctor",
    body: "Lumina's AI summaries reflect your own words back to you. We are not a clinical tool.",
  },
  {
    icon: "🗑",
    title: "You own your data",
    body: "Export or delete everything at any time, instantly.",
  },
];

export default function ConsentScreen() {
  const [accepted, setAccepted] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Before we begin</Text>
        <Text style={styles.subheading}>
          Lumina holds sensitive emotional data. Here's our promise to you.
        </Text>

        {CONSENT_ITEMS.map((item) => (
          <View key={item.title} style={styles.item}>
            <Text style={styles.itemIcon}>{item.icon}</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody}>{item.body}</Text>
            </View>
          </View>
        ))}

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setAccepted((v) => !v)}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand and agree to Lumina's privacy practices
          </Text>
        </Pressable>

        <CTAButton
          label="Continue"
          size="lg"
          disabled={!accepted}
          onPress={() => router.push("/(onboarding)/sign-up")}
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.xl, gap: spacing.md },
  heading: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  subheading: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    marginBottom: spacing.md,
  },
  item: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  itemIcon: { fontSize: typography.size.xl },
  itemText: { flex: 1, gap: spacing.xs },
  itemTitle: {
    fontSize: typography.size.md,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  itemBody: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent.purple,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.accent.purple },
  checkmark: { color: colors.text.inverse, fontSize: 14, fontWeight: "bold" },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  cta: { marginTop: spacing.md },
});
