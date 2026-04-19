import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { apiPatch } from "../../src/lib/api";
import { CTAButton } from "../../src/components/CTAButton";
import { CityAutocomplete } from "../../src/components/CityAutocomplete";
import { astrologyService } from "../../src/services/astrology";
import { hasSupabaseConfig } from "../../src/lib/supabase";
import { formatLocation, type GeocodeResult } from "../../src/services/geocode";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export default function ProfileSetupScreen() {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [city, setCity] = useState<GeocodeResult | null>(null);
  const [babyName, setBabyName] = useState("");
  const [babyBirthDate, setBabyBirthDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validBirth = !birthDate || DATE_RE.test(birthDate);
  const validTime = !birthTime || TIME_RE.test(birthTime);
  const validBabyDate = !babyBirthDate || DATE_RE.test(babyBirthDate);

  const handleContinue = async () => {
    if (!validBirth) {
      Alert.alert("Birth date format", "Please use YYYY-MM-DD (e.g. 1992-08-14).");
      return;
    }
    if (!validTime) {
      Alert.alert("Birth time format", "Please use HH:MM (24h, e.g. 14:30) or leave blank.");
      return;
    }
    if (!validBabyDate) {
      Alert.alert("Baby birth date", "Please use YYYY-MM-DD or leave blank.");
      return;
    }

    setIsLoading(true);
    try {
      if (hasSupabaseConfig) {
        await apiPatch("/v1/profile/me", {
          babyName: babyName || undefined,
          babyBirthDate: babyBirthDate || undefined,
        }).catch(() => {
          // non-fatal
        });
      }

      if (birthDate) {
        await astrologyService
          .createProfile({
            birthDate,
            ...(birthTime ? { birthTime } : {}),
            ...(city ? { birthPlace: formatLocation(city) } : {}),
            ...(city ? { birthLatitude: city.latitude } : {}),
            ...(city ? { birthLongitude: city.longitude } : {}),
            ...(babyBirthDate ? { babyBirthDate } : {}),
          })
          .catch(() => {
            // demo store already saves locally; non-fatal otherwise
          });
      }
    } catch {
      // entire setup is non-fatal — they can edit in settings later
    }
    setIsLoading(false);
    router.replace("/(tabs)/home");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.heading}>A few stars to align</Text>
          <Text style={styles.subheading}>
            Your birth chart shapes the daily Cosmos. The rest is optional.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About you</Text>

            <Field
              label="Your birth date"
              placeholder="YYYY-MM-DD"
              value={birthDate}
              onChange={setBirthDate}
              valid={validBirth}
              hint="Required for personalised cosmic readings."
            />

            <Field
              label="Birth time (optional)"
              placeholder="HH:MM"
              value={birthTime}
              onChange={setBirthTime}
              valid={validTime}
              hint="Together with city, unlocks your Ascendant."
              keyboardType="numbers-and-punctuation"
            />

            <CityAutocomplete
              label="Birth city (optional)"
              placeholder="Start typing a city…"
              hint="We use the city to anchor your chart in time and place."
              value={city}
              onChange={setCity}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About your little one (optional)</Text>
            <Field
              label="Baby's name"
              placeholder="e.g. Luna"
              value={babyName}
              onChange={setBabyName}
            />
            <Field
              label="Baby's birth date"
              placeholder="YYYY-MM-DD"
              value={babyBirthDate}
              onChange={setBabyBirthDate}
              valid={validBabyDate}
            />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  valid?: boolean;
  hint?: string;
  keyboardType?: "numbers-and-punctuation" | "default";
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  valid = true,
  hint,
  keyboardType = "default",
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !valid && styles.inputInvalid]}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
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
  section: { gap: spacing.md },
  sectionLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: typography.weight.semibold,
  },
  field: { gap: spacing.sm },
  label: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
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
  inputInvalid: { borderColor: colors.tag.exhausted },
  hint: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: -spacing.xs },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
