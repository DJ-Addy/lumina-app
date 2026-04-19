import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../theme/tokens";

export type OrbState = "idle" | "listening" | "speaking" | "thinking";

interface BreathingOrbProps {
  state: OrbState;
  size?: number;
}

interface StateConfig {
  duration: number;
  scaleMin: number;
  scaleMax: number;
  innerMin: number;
  innerMax: number;
  glow: number;
}

const STATE_CONFIG: Record<OrbState, StateConfig> = {
  speaking: {
    duration: 520,
    scaleMin: 0.92,
    scaleMax: 1.18,
    innerMin: 0.7,
    innerMax: 1.05,
    glow: 1,
  },
  thinking: {
    duration: 1400,
    scaleMin: 0.96,
    scaleMax: 1.06,
    innerMin: 0.92,
    innerMax: 1.02,
    glow: 0.75,
  },
  listening: {
    duration: 900,
    scaleMin: 0.92,
    scaleMax: 1.12,
    innerMin: 0.85,
    innerMax: 1,
    glow: 0.85,
  },
  idle: {
    duration: 3800,
    scaleMin: 0.97,
    scaleMax: 1.04,
    innerMin: 0.96,
    innerMax: 1,
    glow: 0.55,
  },
};

export function BreathingOrb({ state, size = 200 }: BreathingOrbProps) {
  const breath = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(STATE_CONFIG.idle.glow)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const config = STATE_CONFIG[state];

    loopRef.current?.stop();
    breath.setValue(0);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: config.duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: config.duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    loopRef.current = loop;

    Animated.timing(glow, {
      toValue: config.glow,
      duration: 400,
      useNativeDriver: true,
    }).start();

    return () => {
      loop.stop();
    };
  }, [state, breath, glow]);

  const config = STATE_CONFIG[state];

  const outerScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [config.scaleMin, config.scaleMax],
  });

  const innerScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [config.innerMax, config.innerMin],
  });

  const haloScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [config.scaleMin * 1.15, config.scaleMax * 1.15],
  });

  const haloOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  return (
    <View
      style={[
        styles.container,
        { width: size * 1.6, height: size * 1.6 },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.halo,
          {
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: size,
            transform: [{ scale: haloScale }],
            opacity: haloOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale: outerScale }],
            opacity: glow,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.core,
            {
              width: size * 0.55,
              height: size * 0.55,
              borderRadius: (size * 0.55) / 2,
              transform: [{ scale: innerScale }],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    backgroundColor: colors.accent.purple,
  },
  orb: {
    backgroundColor: `${colors.accent.purple}55`,
    borderWidth: 1,
    borderColor: `${colors.accent.purple}80`,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
  },
  core: {
    backgroundColor: colors.accent.rose,
    opacity: 0.85,
  },
});
