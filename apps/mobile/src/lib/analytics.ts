import PostHog from "posthog-react-native";

let client: PostHog | null = null;

export function initAnalytics() {
  const key = process.env["EXPO_PUBLIC_POSTHOG_KEY"];
  if (!key) return;
  client = new PostHog(key, { host: "https://app.posthog.com" });
}

type EventProps = Record<string, string | number | boolean | null>;

export function track(event: string, properties?: EventProps) {
  if (properties) client?.capture(event, properties);
  else client?.capture(event);
}

export function identify(userId: string, traits?: EventProps) {
  if (traits) client?.identify(userId, traits);
  else client?.identify(userId);
}

export function reset() {
  client?.reset();
}

export const Events = {
  ONBOARDING_COMPLETE: "onboarding_complete",
  JOURNAL_ENTRY_CREATED: "journal_entry_created",
  JOURNAL_ENTRY_VOICE: "journal_entry_voice",
  JOURNAL_ENTRY_MICRO: "journal_entry_micro",
  NIGHT_MODE_ENTERED: "night_mode_entered",
  COMMUNITY_POST_CREATED: "community_post_created",
  COMMUNITY_FOLLOW: "community_follow",
  SUMMARY_VIEWED: "summary_viewed",
  ASTROLOGY_CARD_VIEWED: "astrology_card_viewed",
  MEMORY_BOOK_REQUESTED: "memory_book_requested",
  UPGRADE_VIEWED: "upgrade_viewed",
  ACCOUNT_DELETED: "account_deleted",
} as const;
