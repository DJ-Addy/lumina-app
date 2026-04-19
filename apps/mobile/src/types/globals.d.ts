declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_POSTHOG_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_IOS_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?: string;
    NODE_ENV?: "development" | "test" | "production";
    [key: string]: string | undefined;
  };
};
