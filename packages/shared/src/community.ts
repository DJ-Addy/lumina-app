import { z } from "zod";
import {
  CommunityPostVisibility,
  CommunityReactionType,
  ReportReason,
  CommunityPostType,
  CommunityMediaKind,
  CommunityMediaStatus,
} from "./enums";

export const CommunityProfileSchema = z.object({
  id: z.string().uuid(),
  alias: z.string().min(2).max(40),
  avatarSeed: z.string(),
  bio: z.string().max(160).nullable(),
  followersCount: z.number().int().min(0),
  followingCount: z.number().int().min(0),
  postCount: z.number().int().min(0),
  joinedAt: z.string().datetime(),
  isSuspended: z.boolean().optional().default(false),
});
export type CommunityProfile = z.infer<typeof CommunityProfileSchema>;

export const UpdateCommunityProfileRequestSchema = z.object({
  alias: z.string().min(2).max(40).optional(),
  bio: z.string().max(160).nullable().optional(),
});
export type UpdateCommunityProfileRequest = z.infer<typeof UpdateCommunityProfileRequestSchema>;

// ============================================================
// MEDIA
// ============================================================
export const CommunityMediaVariantSchema = z.object({
  key: z.string(),
  label: z.enum(["480p", "720p", "1080p", "audio", "thumb"]),
  url: z.string().url().optional(),
  bitrateKbps: z.number().int().positive().optional(),
  codec: z.string().optional(),
});
export type CommunityMediaVariant = z.infer<typeof CommunityMediaVariantSchema>;

export const CommunityMediaSchema = z.object({
  id: z.string().uuid(),
  kind: z.nativeEnum(CommunityMediaKind),
  status: z.nativeEnum(CommunityMediaStatus),
  url: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  bytes: z.number().int().nullable(),
  mimeType: z.string().nullable(),
  variants: z.array(CommunityMediaVariantSchema).default([]),
});
export type CommunityMedia = z.infer<typeof CommunityMediaSchema>;

export const SignUploadRequestSchema = z.object({
  kind: z.nativeEnum(CommunityMediaKind),
  mimeType: z.string().min(1).max(120),
  bytes: z.number().int().positive().max(500 * 1024 * 1024), // 500MB hard cap
});
export type SignUploadRequest = z.infer<typeof SignUploadRequestSchema>;

export const SignUploadResponseSchema = z.object({
  mediaId: z.string().uuid(),
  uploadUrl: z.string().url(),
  storageKey: z.string(),
  storageBucket: z.string(),
  // optional fields the client posts back during the PUT
  token: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type SignUploadResponse = z.infer<typeof SignUploadResponseSchema>;

export const FinalizeUploadRequestSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().optional(),
});
export type FinalizeUploadRequest = z.infer<typeof FinalizeUploadRequestSchema>;

// ============================================================
// POLLS
// ============================================================
export const PollOptionSchema = z.object({
  id: z.string().min(1).max(8),
  label: z.string().min(1).max(80),
});
export type PollOption = z.infer<typeof PollOptionSchema>;

export const CommunityPollSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(1).max(200),
  options: z.array(PollOptionSchema).min(2).max(4),
  totalVotes: z.number().int().min(0),
  voteCounts: z.record(z.string(), z.number().int().min(0)),
  endsAt: z.string().datetime().nullable(),
  viewerVote: z.string().nullable().optional(),
});
export type CommunityPoll = z.infer<typeof CommunityPollSchema>;

export const CreatePollRequestSchema = z.object({
  question: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
  endsInHours: z.number().int().positive().max(24 * 30).optional(),
});
export type CreatePollRequest = z.infer<typeof CreatePollRequestSchema>;

export const CastVoteRequestSchema = z.object({
  optionId: z.string().min(1).max(8),
});
export type CastVoteRequest = z.infer<typeof CastVoteRequestSchema>;

// ============================================================
// POSTS
// ============================================================

// "Lite" version for repostOf to avoid recursive schema (no nested reposts)
export const CommunityPostLiteSchema = z.object({
  id: z.string().uuid(),
  postType: z.nativeEnum(CommunityPostType),
  authorProfile: CommunityProfileSchema,
  content: z.string().max(1000).nullable(),
  excerpt: z.string().max(280).nullable(),
  media: z.array(CommunityMediaSchema).default([]),
  poll: CommunityPollSchema.nullable().optional(),
  createdAt: z.string().datetime(),
});
export type CommunityPostLite = z.infer<typeof CommunityPostLiteSchema>;

export const CommunityPostSchema = z.object({
  id: z.string().uuid(),
  postType: z.nativeEnum(CommunityPostType),
  authorProfile: CommunityProfileSchema,
  content: z.string().max(1000).nullable(),
  excerpt: z.string().max(280).nullable(),
  visibility: z.nativeEnum(CommunityPostVisibility),
  isFromJournal: z.boolean(),
  media: z.array(CommunityMediaSchema).default([]),
  poll: CommunityPollSchema.nullable().optional(),
  repostOf: CommunityPostLiteSchema.nullable().optional(),
  reactionCounts: z.record(z.string(), z.number()),
  commentCount: z.number().int().min(0),
  likeCount: z.number().int().min(0).default(0),
  saveCount: z.number().int().min(0).default(0),
  repostCount: z.number().int().min(0).default(0),
  viewCount: z.number().int().min(0).default(0),
  viewerReaction: z.nativeEnum(CommunityReactionType).nullable(),
  viewerIsFollowing: z.boolean(),
  viewerHasSaved: z.boolean().default(false),
  viewerHasReposted: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CommunityPost = z.infer<typeof CommunityPostSchema>;

export const CreateCommunityPostRequestSchema = z.object({
  postType: z.nativeEnum(CommunityPostType).optional().default("text"),
  content: z.string().max(1000).optional(),
  excerpt: z.string().max(280).optional(),
  visibility: z.nativeEnum(CommunityPostVisibility).optional().default("public"),
  journalEntryId: z.string().uuid().optional(),
  mediaIds: z.array(z.string().uuid()).max(10).optional(),
  repostOfId: z.string().uuid().optional(),
  poll: CreatePollRequestSchema.optional(),
}).refine(
  (data) => {
    // text/repost requires content; image/video requires media; poll requires poll
    if (data.postType === "image" || data.postType === "video") {
      return (data.mediaIds?.length ?? 0) > 0;
    }
    if (data.postType === "poll") return !!data.poll;
    if (data.postType === "repost") return !!data.repostOfId;
    return (data.content?.trim().length ?? 0) > 0;
  },
  { message: "Post is missing required fields for its post_type" },
);
export type CreateCommunityPostRequest = z.infer<typeof CreateCommunityPostRequestSchema>;

export const CommunityFeedResponseSchema = z.object({
  posts: z.array(CommunityPostSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type CommunityFeedResponse = z.infer<typeof CommunityFeedResponseSchema>;

export const CommunityFeedQuerySchema = z.object({
  tab: z.enum(["latest", "following", "saved"]).optional().default("latest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(30).optional().default(20),
  postType: z.nativeEnum(CommunityPostType).optional(),
});
export type CommunityFeedQuery = z.infer<typeof CommunityFeedQuerySchema>;

// ============================================================
// REELS (vertical video feed)
// ============================================================
export const ReelsFeedQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
});
export type ReelsFeedQuery = z.infer<typeof ReelsFeedQuerySchema>;

export const ReelsFeedResponseSchema = z.object({
  posts: z.array(CommunityPostSchema),
  nextCursor: z.number().int().nullable(),
  hasMore: z.boolean(),
});
export type ReelsFeedResponse = z.infer<typeof ReelsFeedResponseSchema>;

// ============================================================
// COMMENTS (extended with likes)
// ============================================================

export const CommunityCommentSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  authorProfile: CommunityProfileSchema,
  content: z.string().min(1).max(500),
  likeCount: z.number().int().min(0).default(0),
  viewerHasLiked: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type CommunityComment = z.infer<typeof CommunityCommentSchema>;

export const CreateCommentRequestSchema = z.object({
  content: z.string().min(1).max(500),
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

export const CommentsResponseSchema = z.object({
  comments: z.array(CommunityCommentSchema),
  total: z.number().int(),
});
export type CommentsResponse = z.infer<typeof CommentsResponseSchema>;

export const AddReactionRequestSchema = z.object({
  reaction: z.nativeEnum(CommunityReactionType),
});
export type AddReactionRequest = z.infer<typeof AddReactionRequestSchema>;

export const ReportRequestSchema = z.object({
  targetType: z.enum(["post", "comment", "profile"]),
  targetId: z.string().uuid(),
  reason: z.nativeEnum(ReportReason),
  details: z.string().max(500).optional(),
});
export type ReportRequest = z.infer<typeof ReportRequestSchema>;

export const DismissPostRequestSchema = z.object({
  reason: z.enum(["not_interested", "seen_already", "too_similar"]).optional(),
});
export type DismissPostRequest = z.infer<typeof DismissPostRequestSchema>;

export const SavedPostsResponseSchema = z.object({
  posts: z.array(CommunityPostSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type SavedPostsResponse = z.infer<typeof SavedPostsResponseSchema>;
