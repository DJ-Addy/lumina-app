import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { nightModeService } from "../services/nightMode";
import { colors, spacing, typography, radius } from "../theme/tokens";

export function NightFeedBanner() {
  const { data } = useQuery({
    queryKey: ["night-feed"],
    queryFn: nightModeService.getFeed,
    refetchInterval: 60000,
  });

  if (!data) return null;

  return (
    <Pressable
      style={styles.banner}
      onPress={() => router.push("/night-feed")}
    >
      <Text style={styles.icon}>🌙</Text>
      <View style={styles.textGroup}>
        <Text style={styles.headline}>
          {data.activeMomsCount > 0
            ? `${data.activeMomsCount} moms are journaling right now`
            : "You are not alone"}
        </Text>
        <Text style={styles.sub}>{data.prompt}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: `${colors.night.accent}18`,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.night.accent}30`,
  },
  icon: { fontSize: typography.size.xl },
  textGroup: { flex: 1, gap: 2 },
  headline: {
    fontSize: typography.size.sm,
    color: colors.night.text,
    fontWeight: typography.weight.semibold,
  },
  sub: {
    fontSize: typography.size.xs,
    color: colors.night.accent,
    fontStyle: "italic",
  },
  arrow: {
    fontSize: typography.size.xl,
    color: colors.night.accent,
  },
});
