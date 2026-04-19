import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { searchCities, formatLocation, type GeocodeResult } from "../services/geocode";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface CityAutocompleteProps {
  label: string;
  hint?: string;
  placeholder?: string;
  value: GeocodeResult | null;
  onChange: (result: GeocodeResult | null) => void;
}

export function CityAutocomplete({
  label,
  hint,
  placeholder = "e.g. Brooklyn, New York",
  value,
  onChange,
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value ? formatLocation(value) : "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || (value && query === formatLocation(value))) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      const found = await searchCities(query);
      if (seq !== seqRef.current) return;
      setResults(found);
      setLoading(false);
      setOpen(found.length > 0);
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value]);

  const handlePick = (r: GeocodeResult) => {
    onChange(r);
    setQuery(formatLocation(r));
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleChangeText = (t: string) => {
    setQuery(t);
    if (value && t !== formatLocation(value)) onChange(null);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, value && styles.inputSelected]}
          placeholder={placeholder}
          placeholderTextColor={colors.text.muted}
          value={query}
          onChangeText={handleChangeText}
          autoCapitalize="words"
          autoCorrect={false}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {value ? (
          <Pressable onPress={handleClear} style={styles.clearBtn} hitSlop={10}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : loading ? (
          <View style={styles.clearBtn}>
            <ActivityIndicator size="small" color={colors.text.muted} />
          </View>
        ) : null}
      </View>

      {value ? (
        <Text style={styles.confirmedHint}>
          ✓ {formatLocation(value)} · {value.timezone}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      {open && results.length > 0 ? (
        <View style={styles.dropdown}>
          {results.map((r, idx) => (
            <Pressable
              key={r.id}
              onPress={() => handlePick(r)}
              style={({ pressed }) => [
                styles.option,
                idx === results.length - 1 && styles.optionLast,
                pressed && styles.optionPressed,
              ]}
            >
              <Text style={styles.optionName}>{r.name}</Text>
              <Text style={styles.optionMeta}>
                {r.admin1 && r.admin1 !== r.name ? `${r.admin1}, ${r.country}` : r.country}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { fontSize: typography.size.sm, color: colors.text.secondary },

  inputWrap: { position: "relative" },
  input: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.xl,
    fontSize: typography.size.md,
    color: colors.text.primary,
  },
  inputSelected: { borderColor: `${colors.accent.aqua}66` },
  clearBtn: {
    position: "absolute",
    right: spacing.sm,
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { color: colors.text.muted, fontSize: typography.size.md },

  hint: { fontSize: typography.size.xs, color: colors.text.muted },
  confirmedHint: { fontSize: typography.size.xs, color: colors.accent.aqua },

  dropdown: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: 2,
  },
  optionLast: { borderBottomWidth: 0 },
  optionPressed: { backgroundColor: colors.background.cardHover },
  optionName: {
    fontSize: typography.size.md,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  optionMeta: { fontSize: typography.size.xs, color: colors.text.muted },
});
