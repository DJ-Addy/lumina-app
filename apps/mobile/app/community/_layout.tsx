import { Stack } from "expo-router";
import { colors } from "../../src/theme/tokens";

export default function CommunityStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background.primary },
        headerTintColor: colors.text.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <Stack.Screen name="post/[id]" options={{ title: "" }} />
      <Stack.Screen name="share-composer" options={{ title: "Share", presentation: "modal" }} />
      <Stack.Screen name="reels" options={{ headerShown: false, presentation: "fullScreenModal" }} />
    </Stack>
  );
}
