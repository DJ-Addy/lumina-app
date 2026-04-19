import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radius, spacing } from "../theme/tokens";

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: "default" | "night";
  padding?: keyof typeof spacing;
}

export function GlassCard({ children, variant = "default", padding = "md", style, ...props }: GlassCardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === "night" && styles.nightCard,
        { padding: spacing[padding] },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  nightCard: {
    backgroundColor: colors.night.card,
    borderColor: "rgba(252,165,165,0.1)",
  },
});
