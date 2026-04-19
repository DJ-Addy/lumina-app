import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Pressable,
} from "react-native";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Placement, PlanetKey, ZodiacSign } from "@lumina/shared";
import { astrologyService } from "../../src/services/astrology";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

const PLANET_META: Record<
  PlanetKey,
  { label: string; sigil: string; archetype: string; color: string }
> = {
  sun:       { label: "Sun",       sigil: "☉", archetype: "Your essence",      color: "#FDE68A" },
  moon:      { label: "Moon",      sigil: "☽", archetype: "Your inner world",  color: "#E0D6F0" },
  ascendant: { label: "Ascendant", sigil: "ASC", archetype: "How you arrive",  color: "#F9A8D4" },
  mercury:   { label: "Mercury",   sigil: "☿", archetype: "How you think",     color: "#67E8F9" },
  venus:     { label: "Venus",     sigil: "♀", archetype: "How you love",      color: "#F9A8D4" },
  mars:      { label: "Mars",      sigil: "♂", archetype: "How you act",       color: "#FCA5A5" },
  jupiter:   { label: "Jupiter",   sigil: "♃", archetype: "How you grow",      color: "#86EFAC" },
  saturn:    { label: "Saturn",    sigil: "♄", archetype: "How you build",     color: "#A89BC0" },
  uranus:    { label: "Uranus",    sigil: "♅", archetype: "How you break free", color: "#67E8F9" },
  neptune:   { label: "Neptune",   sigil: "♆", archetype: "How you dream",     color: "#C084FC" },
  pluto:     { label: "Pluto",     sigil: "♇", archetype: "How you transform", color: "#E8A0E0" },
};

const SIGN_GLYPH: Record<ZodiacSign, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋",
  Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏",
  Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

const SIGN_DESCRIPTION: Record<ZodiacSign, string> = {
  Aries: "fire that starts things",
  Taurus: "earth that holds steady",
  Gemini: "air that questions everything",
  Cancer: "water that remembers",
  Leo: "fire that wants to be seen",
  Virgo: "earth that refines",
  Libra: "air that weighs both sides",
  Scorpio: "water that goes deep",
  Sagittarius: "fire that wanders",
  Capricorn: "earth that climbs",
  Aquarius: "air that breaks the rule",
  Pisces: "water that dissolves",
};

const PLANET_X_SIGN: Record<string, string> = {
  // a few flagship combos; falls back to a templated description
  "sun:Aries": "You arrive like weather. Direct, bright, faintly dangerous.",
  "sun:Cancer": "You feel the room before you walk in. That's your superpower and your tax.",
  "moon:Pisces": "Your inner world has a soundtrack. Be careful who gets to score it.",
  "venus:Taurus": "You love slowly and on purpose. Don't apologize for the standards.",
  "mars:Scorpio": "You don't fight on the surface. You wait, and then you mean it.",
  "mercury:Gemini": "Your brain reads multiple tabs at once. Choose which one to close.",
};

export default function NatalChartScreen() {
  const chartQuery = useQuery({
    queryKey: ["natal-chart"],
    queryFn: astrologyService.getNatalChart,
  });

  const chart = chartQuery.data?.chart ?? null;
  const placements = chart?.placements ?? [];
  const ordered = orderPlacements(placements);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "" }} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Your sky, the day you arrived</Text>
          <Text style={styles.title}>The chart{"\n"}underneath you.</Text>
          {chart ? (
            <Text style={styles.meta}>
              {chart.birthDate}
              {chart.birthTime ? `  ·  ${chart.birthTime}` : ""}
              {chart.birthPlace ? `  ·  ${chart.birthPlace}` : ""}
            </Text>
          ) : null}
        </View>

        {!chart && !chartQuery.isLoading ? (
          <EmptyChart />
        ) : null}

        {chart && !chart.hasExactTime ? (
          <View style={styles.noticeWrap}>
            <Text style={styles.noticeText}>
              Add your <Text style={styles.noticeAccent}>birth time</Text> and{" "}
              <Text style={styles.noticeAccent}>coordinates</Text> in profile setup to unlock your
              Ascendant.
            </Text>
          </View>
        ) : null}

        <View style={styles.bigThree}>
          {(["sun", "moon", "ascendant"] as PlanetKey[]).map((key) => {
            const p = ordered.find((x) => x.planet === key);
            return <BigThreeCard key={key} planet={key} placement={p ?? null} />;
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>The rest of you</Text>
          <Text style={styles.sectionSubtitle}>The personal and outer planets</Text>
        </View>

        <View style={styles.list}>
          {ordered
            .filter((p) => p.planet !== "sun" && p.planet !== "moon" && p.planet !== "ascendant")
            .map((p) => (
              <PlacementRow key={p.planet} placement={p} />
            ))}
        </View>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.backText}>← Back to Cosmos</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function BigThreeCard({
  planet,
  placement,
}: {
  planet: PlanetKey;
  placement: Placement | null;
}) {
  const meta = PLANET_META[planet];
  if (!placement) {
    return (
      <View style={[styles.bigCard, { borderColor: `${meta.color}33` }]}>
        <Text style={[styles.bigSigil, { color: meta.color, opacity: 0.3 }]}>{meta.sigil}</Text>
        <Text style={[styles.bigPlanet, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.bigEmptyText}>—</Text>
        <Text style={styles.bigArchetype}>
          {planet === "ascendant" ? "Add birth time + place" : meta.archetype}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.bigCard, { borderColor: `${meta.color}55` }]}>
      <Text style={[styles.bigSigil, { color: meta.color }]}>{meta.sigil}</Text>
      <Text style={[styles.bigPlanet, { color: meta.color }]}>{meta.label}</Text>
      <Text style={styles.bigSign}>{placement.sign}</Text>
      <Text style={styles.bigDegree}>
        {SIGN_GLYPH[placement.sign]}  {placement.degree.toFixed(1)}°
      </Text>
      <Text style={styles.bigArchetype}>{meta.archetype}</Text>
    </View>
  );
}

function PlacementRow({ placement }: { placement: Placement }) {
  const meta = PLANET_META[placement.planet];
  const description =
    PLANET_X_SIGN[`${placement.planet}:${placement.sign}`] ??
    `Your ${meta.label} in ${placement.sign} is ${SIGN_DESCRIPTION[placement.sign]}.`;
  return (
    <View style={styles.rowCard}>
      <View style={[styles.rowSigil, { borderColor: `${meta.color}55` }]}>
        <Text style={[styles.rowSigilText, { color: meta.color }]}>{meta.sigil}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowPlanet, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.rowIn}>in</Text>
          <Text style={styles.rowSign}>{placement.sign}</Text>
          <Text style={styles.rowSignGlyph}>{SIGN_GLYPH[placement.sign]}</Text>
          {placement.retrograde ? <Text style={styles.rowRetro}>℞</Text> : null}
        </View>
        <Text style={styles.rowDegree}>{placement.degree.toFixed(1)}°</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
    </View>
  );
}

function EmptyChart() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptySigil}>✦</Text>
      <Text style={styles.emptyTitle}>No chart yet.</Text>
      <Text style={styles.emptyBody}>
        Add your birth date in profile setup and your sky will appear here.
      </Text>
      <Pressable
        onPress={() => router.push("/(onboarding)/profile-setup")}
        style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.emptyBtnText}>Add birth date</Text>
      </Pressable>
    </View>
  );
}

const PLANET_ORDER: PlanetKey[] = [
  "sun",
  "moon",
  "ascendant",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];

function orderPlacements(placements: Placement[]): Placement[] {
  return [...placements].sort(
    (a, b) => PLANET_ORDER.indexOf(a.planet) - PLANET_ORDER.indexOf(b.planet),
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { paddingBottom: spacing.xxxl, gap: spacing.xl, paddingTop: spacing.lg },

  header: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  kicker: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    letterSpacing: 2,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
  },
  title: {
    fontSize: typography.size.display,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    lineHeight: typography.size.display * 1.05,
    letterSpacing: -1,
  },
  meta: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  noticeWrap: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: `${colors.accent.yellow}10`,
    borderWidth: 1,
    borderColor: `${colors.accent.yellow}30`,
  },
  noticeText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },
  noticeAccent: { color: colors.accent.yellow, fontWeight: typography.weight.semibold },

  bigThree: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  bigCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  bigSigil: { fontSize: 32, fontWeight: typography.weight.bold },
  bigPlanet: {
    fontSize: typography.size.xs,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: typography.weight.bold,
    marginTop: spacing.xs,
  },
  bigSign: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    marginTop: spacing.xs,
    letterSpacing: -0.5,
  },
  bigDegree: { fontSize: typography.size.sm, color: colors.text.secondary },
  bigArchetype: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: spacing.xs,
    fontStyle: "italic",
  },
  bigEmptyText: {
    fontSize: typography.size.xl,
    color: colors.text.muted,
    fontWeight: typography.weight.bold,
    marginTop: spacing.xs,
  },

  sectionHeader: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  sectionTitle: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
  },
  sectionSubtitle: { fontSize: typography.size.sm, color: colors.text.muted, fontStyle: "italic" },

  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  rowCard: {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  rowSigil: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowSigilText: { fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  rowBody: { flex: 1, gap: 4 },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  rowPlanet: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  rowIn: { fontSize: typography.size.sm, color: colors.text.muted },
  rowSign: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  rowSignGlyph: { fontSize: typography.size.lg, color: colors.text.primary, marginLeft: 2 },
  rowRetro: {
    fontSize: typography.size.md,
    color: colors.tag.exhausted,
    marginLeft: 4,
    fontWeight: typography.weight.bold,
  },
  rowDegree: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: 2 },
  rowDescription: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
    marginTop: spacing.xs,
  },

  empty: {
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
    gap: spacing.md,
  },
  emptySigil: { fontSize: 48, color: colors.accent.purple },
  emptyTitle: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  emptyBody: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
  },
  emptyBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  emptyBtnText: { color: colors.text.inverse, fontWeight: typography.weight.bold },

  backBtn: { padding: spacing.lg, alignItems: "center" },
  backText: { color: colors.accent.purple, fontSize: typography.size.md },
});
