export const JournalEntryMode = {
  TEXT: "text",
  VOICE: "voice",
  MICRO: "micro",
} as const;
export type JournalEntryMode = (typeof JournalEntryMode)[keyof typeof JournalEntryMode];

export const MoodTag = {
  GRATEFUL: "grateful",
  EXHAUSTED: "exhausted",
  ANXIOUS: "anxious",
  JOYFUL: "joyful",
  SAD: "sad",
  NUMB: "numb",
  CONNECTED: "connected",
  LONELY: "lonely",
  OVERWHELMED: "overwhelmed",
  PROUD: "proud",
  ANGRY: "angry",
  HOPEFUL: "hopeful",
} as const;
export type MoodTag = (typeof MoodTag)[keyof typeof MoodTag];

export const SubscriptionTier = {
  FREE: "free",
  PRO: "pro",
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const SummaryCadence = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
} as const;
export type SummaryCadence = (typeof SummaryCadence)[keyof typeof SummaryCadence];

export const PromptCategory = {
  IDENTITY: "identity",
  BODY: "body",
  RELATIONSHIP: "relationship",
  GRATITUDE: "gratitude",
  NIGHT: "night",
  COSMIC: "cosmic",
  GENERAL: "general",
} as const;
export type PromptCategory = (typeof PromptCategory)[keyof typeof PromptCategory];

export const CommunityPostVisibility = {
  PUBLIC: "public",
  FOLLOWERS: "followers",
} as const;
export type CommunityPostVisibility =
  (typeof CommunityPostVisibility)[keyof typeof CommunityPostVisibility];

export const CommunityReactionType = {
  HEART: "heart",
  CANDLE: "candle",
  MOON: "moon",
  STAR: "star",
} as const;
export type CommunityReactionType =
  (typeof CommunityReactionType)[keyof typeof CommunityReactionType];

export const ReportReason = {
  HARMFUL_CONTENT: "harmful_content",
  SPAM: "spam",
  MISINFORMATION: "misinformation",
  HARASSMENT: "harassment",
  OTHER: "other",
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const ModerationStatus = {
  PENDING: "pending",
  REVIEWED: "reviewed",
  ACTIONED: "actioned",
  DISMISSED: "dismissed",
} as const;
export type ModerationStatus = (typeof ModerationStatus)[keyof typeof ModerationStatus];

export const CommunityPostType = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  POLL: "poll",
  REPOST: "repost",
} as const;
export type CommunityPostType =
  (typeof CommunityPostType)[keyof typeof CommunityPostType];

export const CommunityMediaKind = {
  IMAGE: "image",
  VIDEO: "video",
} as const;
export type CommunityMediaKind =
  (typeof CommunityMediaKind)[keyof typeof CommunityMediaKind];

export const CommunityMediaStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
  DELETED: "deleted",
} as const;
export type CommunityMediaStatus =
  (typeof CommunityMediaStatus)[keyof typeof CommunityMediaStatus];
