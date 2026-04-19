import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/auth";

export default function Index() {
  const { session, isDemoMode, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (!session && !isDemoMode) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
