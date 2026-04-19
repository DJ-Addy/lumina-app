import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, SafeAreaView, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { apiPatch } from "../../src/lib/api";
import { CTAButton } from "../../src/components/CTAButton";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

export default function ProfileSetupScreen() {
  const [babyName, setBabyName] = useState("");
  const [babyBirthDate, setBabyBirthDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await apiPatch("/v1/profile/me", {
        babyName: babyName || undefined,
        babyBirthDate: babyBirthDate || undefined,
      });
    } catch {
      // Non-fatal — they can complete this later in settings
    }
    setIsLoading(false);
    router.replace("/(tabs)/home");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Tell us a little</Text>
        <Text style={styles.subheading}>
          This helps Lumina personalise prompts for your journey. You can skip anything.
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Baby's name (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Luna"
              placeholderTextColor={colors.text.muted}
              value={babyName}
              onChangeText={setBabyName}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Baby's birth date (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text.muted}
              value={babyBirthDate}
              onChangeText={setBabyBirthDate}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <View style={styles.actions}>
          <CTAButton
            label="Enter Lumina"
            size="lg"
            isLoading={isLoading}
            onPress={handleContinue}
          />
          <CTAButton
            label="Skip for now"
            variant="ghost"
            size="md"
            onPress={() => router.replace("/(tabs)/home")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.xl, gap: spacing.xl, flexGrow: 1, justifyContent: "center" },
  heading: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  subheading: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    marginTop: -spacing.md,
  },
  form: { gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontSize: typography.size.sm, color: colors.text.muted, textTransform: "uppercase", letterSpacing: 1 },
  input: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.text.primary,
  },
  actions: { gap: spacing.md },
});
