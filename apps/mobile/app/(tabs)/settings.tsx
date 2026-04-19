import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Pressable,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "../../src/store/auth";
import { GlassCard } from "../../src/components/GlassCard";
import { CTAButton } from "../../src/components/CTAButton";
import { apiDelete, apiGet, hasApiConfig, isDemoModeError } from "../../src/lib/api";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

interface CreditStatus {
  allowed: boolean;
  tier: "free" | "pro";
  used: number;
  limit: number;
}

interface SettingsRowProps {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
}

function SettingsRow({ icon, label, description, onPress, destructive }: SettingsRowProps) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && { color: "#FC8181" }]}>{label}</Text>
        {description && <Text style={styles.rowDesc}>{description}</Text>}
      </View>
      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const [credits, setCredits] = useState<CreditStatus | null>(null);

  useEffect(() => {
    if (!hasApiConfig) return;
    apiGet<CreditStatus>("/v1/profile/me/credits")
      .then(setCredits)
      .catch((err) => {
        if (!isDemoModeError(err)) console.warn("Failed to load credits:", err);
      });
  }, []);

  const handleExport = async () => {
    if (!hasApiConfig) {
      Alert.alert("Demo mode", "Connect a Lumina API server to export your data.");
      return;
    }
    try {
      const data = await apiGet<unknown>("/v1/profile/me/export");
      Alert.alert("Export ready", "Your data has been exported. Check the console in dev mode.");
      console.log("Lumina data export:", JSON.stringify(data, null, 2));
    } catch {
      Alert.alert("Error", "Failed to export your data. Please try again.");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This will permanently delete your account and all journal entries. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            if (!hasApiConfig) {
              await signOut();
              return;
            }
            try {
              await apiDelete("/v1/profile/me");
              await signOut();
            } catch {
              Alert.alert("Error", "Failed to delete account. Please try again.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <GlassCard padding="xs">
            <SettingsRow
              icon="👤"
              label="Edit Profile"
              description="Name, baby name, birth date"
              onPress={() => router.push("/settings/profile")}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="✦"
              label="Astrology Profile"
              description="Birth chart, cosmic settings"
              onPress={() => router.push("/settings/astrology")}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="☽"
              label="Community Profile"
              description="Alias, bio, privacy"
              onPress={() => router.push("/settings/community-profile")}
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Subscription</Text>
          <GlassCard padding="xs">
            <SettingsRow
              icon="✧"
              label={credits?.tier === "pro" ? "Lumina Pro (Active)" : "Lumina Pro"}
              description={
                credits
                  ? `Used ${credits.used} of ${credits.limit} reflections this month`
                  : "Unlock voice journaling, AI summaries, and more"
              }
              onPress={() => router.push("/settings/upgrade")}
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your data</Text>
          <GlassCard padding="xs">
            <SettingsRow
              icon="📦"
              label="Export my data"
              description="Download all your journal entries"
              onPress={handleExport}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="🗑"
              label="Delete account"
              description="Permanently remove all data"
              destructive
              onPress={handleDeleteAccount}
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <CTAButton
            label="Sign Out"
            variant="secondary"
            size="md"
            onPress={async () => {
              await signOut();
              router.replace("/(onboarding)/welcome");
            }}
          />
        </View>

        <Text style={styles.version}>Lumina v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  title: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: typography.weight.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowIcon: { fontSize: typography.size.lg, width: 28, textAlign: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: typography.size.md, color: colors.text.primary },
  rowDesc: { fontSize: typography.size.sm, color: colors.text.muted, marginTop: 2 },
  rowArrow: { fontSize: typography.size.lg, color: colors.text.muted },
  version: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textAlign: "center",
  },
});
