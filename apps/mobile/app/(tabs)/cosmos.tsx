import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  RefreshControl,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { HoroscopeDomain, HoroscopeSlice } from "@lumina/shared";
import { astrologyService } from "../../src/services/astrology";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

const DOMAIN_META: Record<
  HoroscopeDomain,
  { label: string; sigil: string; color: string; subtitle: string }
> = {
  work: { label: "Work & Money", sigil: "☿", color: "#FDE68A", subtitle: "what you build" },
  home: { label: "Home & Family", sigil: "♄", color: "#86EFAC", subtitle: "what holds you" },
  love: { label: "Sex & Love", sigil: "♀", color: "#F9A8D4", subtitle: "what wants you" },
  friends: { label: "With Friends", sigil: "☾", color: "#67E8F9", subtitle: "who sees you" },
};

const VIBE_GLYPH: Record<HoroscopeSlice["vibe"], string> = {
  expansive: "✦",
  tender: "✿",
  tense: "✧",
  grounded: "▲",
  luminous: "✸",
  still: "•",
};

export default function CosmosScreen() {
  const [hasBirth, setHasBirth] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    astrologyService.getStoredBirth().then((b) => {
      if (mounted) setHasBirth(Boolean(b));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const horoscopeQuery = useQuery({
    queryKey: ["daily-horoscope"],
    queryFn: astrologyService.getDailyHoroscope,
  });

  const isRefreshing = horoscopeQuery.isFetching && !horoscopeQuery.isLoading;
  const data = horoscopeQuery.data;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => horoscopeQuery.refetch()}
            tintColor={colors.accent.purple}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>{formatToday()}</Text>
          <Text style={styles.title}>Today, decoded.</Text>
          {data ? (
            <Text style={styles.subtitle}>
              <Text style={styles.subtitleAccent}>{data.moonPhase}</Text>
              {"  ·  Moon in "}
              <Text style={styles.subtitleAccent}>{data.moonSign}</Text>
              {data.sunSign ? (
                <Text>
                  {"  ·  "}
                  <Text style={styles.subtitleAccent}>Sun {data.sunSign}</Text>
                </Text>
              ) : null}
            </Text>
          ) : (
            <Text style={styles.subtitle}>Pulling your sky…</Text>
          )}
        </View>

        {data?.headline ? (
          <View style={styles.headlineWrap}>
            <Text style={styles.headlineQuote}>"</Text>
            <Text style={styles.headline}>{data.headline}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push("/cosmos/natal")}
          style={({ pressed }) => [styles.natalCta, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.natalCtaInner}>
            <Text style={styles.natalCtaSigil}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.natalCtaTitle}>Your natal chart</Text>
              <Text style={styles.natalCtaSub}>
                {hasBirth
                  ? "Sun, Moon, Ascendant and the rest of you."
                  : "Add your birth date to unlock all eleven placements."}
              </Text>
            </View>
            <Text style={styles.natalCtaArrow}>→</Text>
          </View>
        </Pressable>

        <View style={styles.slicesWrap}>
          {data?.slices.map((s) => (
            <DomainCard key={s.domain} slice={s} />
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Pulled from real planetary positions, written for you.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DomainCard({ slice }: { slice: HoroscopeSlice }) {
  const meta = DOMAIN_META[slice.domain];
  return (
    <View style={[styles.card, { borderColor: `${meta.color}33` }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.sigilCircle, { borderColor: `${meta.color}55` }]}>
          <Text style={[styles.sigil, { color: meta.color }]}>{meta.sigil}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.domainLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.domainSubtitle}>{meta.subtitle}</Text>
        </View>
        <IntensityDots value={slice.intensity} color={meta.color} />
      </View>

      <Text style={styles.cardTitle}>{slice.title}</Text>
      <Text style={styles.cardBody}>{slice.body}</Text>

      <View style={styles.vibeRow}>
        <Text style={[styles.vibeGlyph, { color: meta.color }]}>{VIBE_GLYPH[slice.vibe]}</Text>
        <Text style={styles.vibeText}>{slice.vibe}</Text>
        {slice.note ? (
          <>
            <Text style={styles.vibeDot}>·</Text>
            <Text style={[styles.noteText, { color: meta.color }]}>{slice.note}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.doDontRow}>
        <View style={styles.doDontCol}>
          <Text style={styles.doLabel}>Do</Text>
          <Text style={styles.doText}>{slice.do}</Text>
        </View>
        <View style={styles.doDontDivider} />
        <View style={styles.doDontCol}>
          <Text style={styles.dontLabel}>Don't</Text>
          <Text style={styles.dontText}>{slice.dont}</Text>
        </View>
      </View>
    </View>
  );
}

function IntensityDots({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i <= value ? color : "rgba(255,255,255,0.12)" },
          ]}
        />
      ))}
    </View>
  );
}

function formatToday(): string {
  const d = new Date();
  return d
    .toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { paddingVertical: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },

  header: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md },
  kicker: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    letterSpacing: 2,
    fontWeight: typography.weight.semibold,
  },
  title: {
    fontSize: typography.size.display,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    lineHeight: typography.size.display * 1.05,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  subtitleAccent: { color: colors.text.primary, fontWeight: typography.weight.semibold },

  headlineWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: `${colors.accent.purple}18`,
    borderWidth: 1,
    borderColor: `${colors.accent.purple}33`,
    position: "relative",
  },
  headlineQuote: {
    position: "absolute",
    top: -spacing.sm,
    left: spacing.md,
    fontSize: 60,
    color: colors.accent.purple,
    opacity: 0.5,
    lineHeight: 60,
  },
  headline: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    lineHeight: typography.size.xl * 1.4,
    fontWeight: typography.weight.medium,
    paddingTop: spacing.sm,
    fontStyle: "italic",
  },

  natalCta: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: `${colors.accent.aqua}15`,
    borderWidth: 1,
    borderColor: `${colors.accent.aqua}40`,
    overflow: "hidden",
  },
  natalCtaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  natalCtaSigil: { fontSize: typography.size.xxl, color: colors.accent.aqua },
  natalCtaTitle: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  natalCtaSub: { fontSize: typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  natalCtaArrow: { fontSize: typography.size.xl, color: colors.accent.aqua },

  slicesWrap: { gap: spacing.md, paddingHorizontal: spacing.lg },

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sigilCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sigil: { fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  domainLabel: {
    fontSize: typography.size.xs,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: typography.weight.bold,
  },
  domainSubtitle: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    marginTop: 2,
    fontStyle: "italic",
  },

  dotsRow: { flexDirection: "row", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  cardTitle: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.3,
  },
  cardBody: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
  },

  vibeRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
  vibeGlyph: { fontSize: typography.size.md },
  vibeText: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: typography.weight.medium,
  },
  vibeDot: { color: colors.text.muted, fontSize: typography.size.xs },
  noteText: {
    fontSize: typography.size.xs,
    letterSpacing: 1,
    fontWeight: typography.weight.semibold,
    fontStyle: "italic",
  },

  divider: { height: 1, backgroundColor: colors.border.subtle, marginVertical: spacing.xs },

  doDontRow: { flexDirection: "row", gap: spacing.md, alignItems: "stretch" },
  doDontCol: { flex: 1, gap: 4 },
  doDontDivider: { width: 1, backgroundColor: colors.border.subtle },
  doLabel: {
    fontSize: typography.size.xs,
    color: colors.accent.aqua,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: typography.weight.bold,
  },
  doText: { fontSize: typography.size.sm, color: colors.text.primary },
  dontLabel: {
    fontSize: typography.size.xs,
    color: colors.tag.exhausted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: typography.weight.bold,
  },
  dontText: { fontSize: typography.size.sm, color: colors.text.primary },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: "center" },
  footerText: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textAlign: "center",
    fontStyle: "italic",
  },
});
