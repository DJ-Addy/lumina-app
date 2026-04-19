import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert } from "react-native";
import { router } from "expo-router";
import { hasSupabaseConfig, supabase } from "../../src/lib/supabase";
import { CTAButton } from "../../src/components/CTAButton";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) return;
    if (!hasSupabaseConfig) {
      Alert.alert("Setup required", "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setIsLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
      return;
    }
    router.replace("/(onboarding)/profile-setup");
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert("Enter your email first");
      return;
    }
    if (!hasSupabaseConfig) {
      Alert.alert("Setup required", "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setIsLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    Alert.alert("Check your email", "We sent you a magic link to sign in.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.subheading}>No real name required. Just you.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.text.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
        </View>

        <View style={styles.actions}>
          <CTAButton
            label="Create Account"
            size="lg"
            isLoading={isLoading}
            disabled={!email || !password}
            onPress={handleSignUp}
          />
          <CTAButton
            label="Send Magic Link Instead"
            variant="secondary"
            size="md"
            isLoading={isLoading}
            onPress={handleMagicLink}
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
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.xl,
  },
  heading: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  subheading: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    marginTop: -spacing.md,
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
  actions: { gap: spacing.md },
});
