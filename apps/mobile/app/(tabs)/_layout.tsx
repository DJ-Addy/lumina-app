import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors, typography } from "../../src/theme/tokens";

const TAB_ICONS: Record<string, string> = {
  home: "✦",
  cosmos: "☉",
  timeline: "◉",
  community: "☽",
  settings: "○",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <Text style={{
            fontSize: focused ? typography.size.xl : typography.size.lg,
            color: focused ? colors.accent.purple : colors.text.muted,
          }}>
            {TAB_ICONS[route.name] ?? "○"}
          </Text>
        ),
        tabBarActiveTintColor: colors.accent.purple,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.border.default,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.medium,
        },
        headerStyle: { backgroundColor: colors.background.primary },
        headerTintColor: colors.text.primary,
        headerShadowVisible: false,
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="cosmos" options={{ title: "Cosmos" }} />
      <Tabs.Screen name="timeline" options={{ title: "Timeline" }} />
      <Tabs.Screen name="community" options={{ title: "Community" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
