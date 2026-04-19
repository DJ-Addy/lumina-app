import { Stack } from "expo-router";
import { colors } from "../../src/theme/tokens";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: "slide_from_right",
      }}
    />
  );
}
