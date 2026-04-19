import type {
  CommunityFeedResponse,
  CommunityFeedQuery,
  CommunityPost,
  CommentsResponse,
  CommunityProfile,
  CreateCommunityPostRequest,
  CreateCommentRequest,
  AddReactionRequest,
  ReportRequest,
  UpdateCommunityProfileRequest,
  ReelsFeedResponse,
  CastVoteRequest,
  DismissPostRequest,
} from "@lumina/shared";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";

export const communityService = {
  // Profile
  getMyProfile: () => apiGet<{ profile: CommunityProfile }>("/v1/community/profile/me"),

  updateMyProfile: (data: UpdateCommunityProfileRequest) =>
    apiPatch<{ profile: CommunityProfile }>("/v1/community/profile/me", data),

  // Feed
  getFeed: (params?: Partial<CommunityFeedQuery>) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return apiGet<CommunityFeedResponse>(`/v1/community/feed${qs}`);
  },

  // Reels
  getReels: (cursor = 0, limit = 8) =>
    apiGet<ReelsFeedResponse>(`/v1/community/reels/?cursor=${cursor}&limit=${limit}`),

  // Posts
  getPost: (postId: string) => apiGet<{ post: CommunityPost }>(`/v1/community/posts/${postId}`),
  createPost: (data: CreateCommunityPostRequest) =>
    apiPost<{ post: CommunityPost }>("/v1/community/posts", data),
  deletePost: (postId: string) => apiDelete(`/v1/community/posts/${postId}`),

  // Saves
  savePost: (postId: string) => apiPost(`/v1/community/posts/${postId}/save`),
  unsavePost: (postId: string) => apiDelete(`/v1/community/posts/${postId}/save`),

  // Dismiss ("not interested")
  dismissPost: (postId: string, data: DismissPostRequest = {}) =>
    apiPost(`/v1/community/posts/${postId}/dismiss`, data),

  // View ping
  pingView: (postId: string) => apiPost(`/v1/community/posts/${postId}/view`),

  // Comments
  getComments: (postId: string) =>
    apiGet<CommentsResponse>(`/v1/community/posts/${postId}/comments`),
  createComment: (postId: string, data: CreateCommentRequest) =>
    apiPost(`/v1/community/posts/${postId}/comments`, data),
  likeComment: (commentId: string) => apiPost(`/v1/community/comments/${commentId}/like`),
  unlikeComment: (commentId: string) => apiDelete(`/v1/community/comments/${commentId}/like`),

  // Reactions
  addReaction: (postId: string, data: AddReactionRequest) =>
    apiPost(`/v1/community/posts/${postId}/reactions`, data),
  removeReaction: (postId: string) => apiDelete(`/v1/community/posts/${postId}/reactions`),

  // Polls
  votePoll: (pollId: string, data: CastVoteRequest) =>
    apiPost(`/v1/community/polls/${pollId}/vote`, data),

  // Follows
  follow: (communityUserId: string) => apiPost(`/v1/community/follows/${communityUserId}`),
  unfollow: (communityUserId: string) => apiDelete(`/v1/community/follows/${communityUserId}`),

  // Reports
  report: (data: ReportRequest) => apiPost("/v1/community/report", data),
};
