import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  ActivityIndicator,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface CTAButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CTAButton({
  label,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  style,
  ...props
}: CTAButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        pressed && styles.pressed,
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === "primary" ? colors.text.inverse : colors.text.primary} size="small" />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`label_${size}`]]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  primary: {
    backgroundColor: colors.accent.purple,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accent.purple,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  size_sm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: 36 },
  size_md: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 48 },
  size_lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minHeight: 56 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: { fontWeight: typography.weight.semibold },
  label_primary: { color: colors.text.inverse },
  label_secondary: { color: colors.accent.purple },
  label_ghost: { color: colors.text.secondary },
  label_sm: { fontSize: typography.size.sm },
  label_md: { fontSize: typography.size.md },
  label_lg: { fontSize: typography.size.lg },
});
