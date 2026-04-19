import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, Animated, Easing } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { CTAButton } from "./CTAButton";

interface Props {
  visible: boolean;
  reelsWatched: number;
  onKeepGoing: () => void;
  onTakeBreath: () => void;
  onLeave: () => void;
}

/**
 * Surfaces after every N reels (default 25) to invite the user to step back,
 * take a breath, or leave the feed.
 */
export function MindfulnessModal({
  visible,
  reelsWatched,
  onKeepGoing,
  onTakeBreath,
  onLeave,
}: Props) {
  const [breathing, setBreathing] = useState(false);
  const orb = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!breathing) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb, {
          toValue: 1.3,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb, {
          toValue: 0.7,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathing, orb]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        {breathing ? (
          <View style={styles.breathing}>
            <Animated.View style={[styles.orb, { transform: [{ scale: orb }] }]} />
            <Text style={styles.breathLabel}>breathe in… and out</Text>
            <Pressable onPress={() => setBreathing(false)} style={styles.closeBreath}>
              <Text style={styles.linkText}>I’m grounded</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.glyph}>☽</Text>
            <Text style={styles.title}>You’ve been here a while</Text>
            <Text style={styles.body}>
              {reelsWatched} reels in this session. How is your nervous system?
              {"\n\n"}A pause won’t cost you anything.
            </Text>

            <View style={styles.actions}>
              <CTAButton
                label="Take one breath"
                size="md"
                onPress={() => setBreathing(true)}
              />
              <CTAButton
                label="Keep watching"
                variant="ghost"
                size="md"
                onPress={onKeepGoing}
              />
              <Pressable onPress={onLeave} style={styles.leaveLink}>
                <Text style={styles.linkText}>Leave the feed</Text>
              </Pressable>
            </View>

            {/* When the user closes via "Take one breath" we still trigger
                onTakeBreath so analytics know they engaged. */}
            <BreathTrigger active={breathing} onTrigger={onTakeBreath} />
          </View>
        )}
      </View>
    </Modal>
  );
}

function BreathTrigger({ active, onTrigger }: { active: boolean; onTrigger: () => void }) {
  const fired = useRef(false);
  useEffect(() => {
    if (active && !fired.current) {
      fired.current = true;
      onTrigger();
    }
    if (!active) fired.current = false;
  }, [active, onTrigger]);
  return null;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(7,6,15,0.94)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center",
    gap: spacing.md,
  },
  glyph: {
    fontSize: 56,
    color: colors.accent.purple,
  },
  title: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
  body: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: "stretch",
  },
  leaveLink: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  linkText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textDecorationLine: "underline",
  },
  breathing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: `${colors.accent.purple}30`,
    borderWidth: 2,
    borderColor: colors.accent.purple,
  },
  breathLabel: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
    letterSpacing: 2,
    textTransform: "lowercase",
  },
  closeBreath: {
    marginTop: spacing.xl,
  },
});
