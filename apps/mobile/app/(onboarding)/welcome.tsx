import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { router } from "expo-router";
import { CTAButton } from "../../src/components/CTAButton";
import { useAuthStore } from "../../src/store/auth";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function WelcomeScreen() {
  const enableDemoMode = useAuthStore((s) => s.enableDemoMode);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.star}>✦</Text>
          <Text style={styles.title}>LUMINA</Text>
          <Text style={styles.subtitle}>The Fourth Trimester Journal</Text>
          <Text style={styles.tagline}>Cosmic. Emotional. Yours.</Text>
        </View>

        <View style={styles.description}>
          <Text style={styles.descriptionText}>
            You just did something extraordinary.
          </Text>
          <Text style={styles.descriptionText}>
            This is a space for you — not just the baby.
          </Text>
        </View>

        <View style={styles.actions}>
          <CTAButton
            label="Begin"
            size="lg"
            onPress={() => router.push("/(onboarding)/consent")}
          />
          <CTAButton
            label="I already have an account"
            variant="ghost"
            size="md"
            onPress={() => router.push("/(onboarding)/sign-in")}
          />
          <CTAButton
            label="Continue in demo mode"
            variant="secondary"
            size="md"
            onPress={() => {
              enableDemoMode();
              router.replace("/(tabs)/home");
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: "space-between",
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  star: {
    fontSize: 48,
    color: colors.accent.rose,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.display,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    letterSpacing: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.size.lg,
    color: colors.text.secondary,
    textAlign: "center",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: typography.size.md,
    color: colors.text.muted,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  description: {
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  descriptionText: {
    fontSize: typography.size.lg,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: typography.size.lg * typography.lineHeight.relaxed,
  },
  actions: { gap: spacing.md },
});
