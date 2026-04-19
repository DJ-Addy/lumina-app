import { z } from "zod";
import { CommunityPostVisibility, CommunityReactionType, ReportReason } from \"./enums\";

export const CommunityProfileSchema = z.object({
  id: z.string().uuid(),
  alias: z.string().min(2).max(40),
  avatarSeed: z.string(),
  bio: z.string().max(160).nullable(),
  followersCount: z.number().int().min(0),
  followingCount: z.number().int().min(0),
  postCount: z.number().int().min(0),
  joinedAt: z.string().datetime(),
});
export type CommunityProfile = z.infer<typeof CommunityProfileSchema>;

export const UpdateCommunityProfileRequestSchema = z.object({
  alias: z.string().min(2).max(40).optional(),
  bio: z.string().max(160).nullable().optional(),
});
export type UpdateCommunityProfileRequest = z.infer<typeof UpdateCommunityProfileRequestSchema>;

export const CommunityPostSchema = z.object({
  id: z.string().uuid(),
  authorProfile: CommunityProfileSchema,
  content: z.string().min(1).max(1000),
  excerpt: z.string().max(280).nullable(),
  visibility: z.nativeEnum(CommunityPostVisibility),
  isFromJournal: z.boolean(),
  reactionCounts: z.record(z.string(), z.number()),
  commentCount: z.number().int().min(0),
  viewerReaction: z.nativeEnum(CommunityReactionType).nullable(),
  viewerIsFollowing: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CommunityPost = z.infer<typeof CommunityPostSchema>;

export const CreateCommunityPostRequestSchema = z.object({
  content: z.string().min(1).max(1000),
  excerpt: z.string().max(280).optional(),
  visibility: z.nativeEnum(CommunityPostVisibility).optional().default("public"),
  journalEntryId: z.string().uuid().optional(),
});
export type CreateCommunityPostRequest = z.infer<typeof CreateCommunityPostRequestSchema>;

export const CommunityFeedResponseSchema = z.object({
  posts: z.array(CommunityPostSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type CommunityFeedResponse = z.infer<typeof CommunityFeedResponseSchema>;

export const CommunityFeedQuerySchema = z.object({
  tab: z.enum(["latest", "following"]).optional().default("latest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(30).optional().default(20),
});
export type CommunityFeedQuery = z.infer<typeof CommunityFeedQuerySchema>;

export const CommunityCommentSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  authorProfile: CommunityProfileSchema,
  content: z.string().min(1).max(500),
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
