import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert } from "react-native";
import { router } from "expo-router";
import { hasSupabaseConfig, supabase } from "../../src/lib/supabase";
import { CTAButton } from "../../src/components/CTAButton";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) return;
    if (!hasSupabaseConfig) {
      Alert.alert("Setup required", "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      Alert.alert("Sign in failed", error.message);
      return;
    }
    router.replace("/(tabs)/home");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Welcome back</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.text.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <CTAButton
          label="Sign In"
          size="lg"
          isLoading={isLoading}
          disabled={!email || !password}
          onPress={handleSignIn}
        />
        <CTAButton
          label="Back"
          variant="ghost"
          size="md"
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.lg,
  },
  heading: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  form: { gap: spacing.md },
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
});
