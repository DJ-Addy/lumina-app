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
} from "@lumina/shared";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";

export const communityService = {
  getMyProfile: () => apiGet<{ profile: CommunityProfile }>("/v1/community/profile/me"),

  updateMyProfile: (data: UpdateCommunityProfileRequest) =>
    apiPatch<{ profile: CommunityProfile }>("/v1/community/profile/me", data),

  getFeed: (params?: Partial<CommunityFeedQuery>) => {
    const qs = params
      ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : "";
    return apiGet<CommunityFeedResponse>(`/v1/community/feed${qs}`);
  },

  getPost: (postId: string) => apiGet<{ post: CommunityPost }>(`/v1/community/posts/${postId}`),

  createPost: (data: CreateCommunityPostRequest) =>
    apiPost<{ post: CommunityPost }>("/v1/community/posts", data),

  deletePost: (postId: string) => apiDelete(`/v1/community/posts/${postId}`),

  getComments: (postId: string) =>
    apiGet<CommentsResponse>(`/v1/community/posts/${postId}/comments`),

  createComment: (postId: string, data: CreateCommentRequest) =>
    apiPost(`/v1/community/posts/${postId}/comments`, data),

  addReaction: (postId: string, data: AddReactionRequest) =>
    apiPost(`/v1/community/posts/${postId}/reactions`, data),

  follow: (communityUserId: string) =>
    apiPost(`/v1/community/follows/${communityUserId}`),

  unfollow: (communityUserId: string) =>
    apiDelete(`/v1/community/follows/${communityUserId}`),

  report: (data: ReportRequest) => apiPost("/v1/community/report", data),
};
