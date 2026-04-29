import {
  NotificationPreferencesResponse,
  NotificationsListApiResponse,
  SessionResponse,
  UpdateNotificationPreferencesPayload,
  UpdateProfilePayload,
  UserMeResponse,
} from "./types";
import { apiRequest } from "./http";
import type {
  CommunityLikeState,
  CommunityPost,
  CommunityPostDetail,
  CommunityComment,
  CreateCommunityCommentPayload,
  CreateCommunityPostPayload,
  UpdateCommunityPostPayload,
} from "@/lib/types/community";
import {
  mapReviewPreviewDetail,
  mapReviewPreviewSummary,
} from "@/lib/reviews/mappers";
import type { ReviewEntrySource } from "@/lib/reviews/navigation";
import type {
  ReviewPreviewDetail,
  ReviewPreviewDetailResponse,
  ReviewPreviewSummary,
  ReviewPreviewSummaryResponse,
} from "@/lib/reviews/types";
import type { PopularTopic } from "@/lib/types/popular";
import type { TrendType } from "@/lib/types/popular";
import type {
  NotificationPreferences,
  NotificationsListResponse,
} from "@/lib/notifications/types";

type PopularTopicApiResponse = Partial<PopularTopic> & {
  requestUserCount?: number;
};

function normalizeCommunityComment(comment: CommunityComment): CommunityComment {
  return {
    ...comment,
    replies: Array.isArray(comment.replies)
      ? comment.replies.map(normalizeCommunityComment)
      : [],
  };
}

function flattenCommunityComments(
  comments: CommunityComment[],
  bucket: Map<string, CommunityComment>,
): void {
  for (const comment of comments) {
    const normalized = normalizeCommunityComment(comment);
    bucket.set(normalized.id, {
      ...normalized,
      replies: [],
    });

    if (normalized.replies.length > 0) {
      flattenCommunityComments(normalized.replies, bucket);
    }
  }
}

function buildCommunityCommentTree(comments: CommunityComment[]): CommunityComment[] {
  const commentMap = new Map<string, CommunityComment>();
  flattenCommunityComments(comments, commentMap);

  const commentsByParentId = new Map<string | null, CommunityComment[]>();

  for (const comment of commentMap.values()) {
    const key = comment.parentCommentId ?? null;
    const siblings = commentsByParentId.get(key) ?? [];
    siblings.push({
      ...comment,
      replies: [],
    });
    commentsByParentId.set(key, siblings);
  }

  const buildReplies = (parentCommentId: string | null): CommunityComment[] =>
    (commentsByParentId.get(parentCommentId) ?? []).map((comment) => ({
      ...comment,
      replies: buildReplies(comment.id),
    }));

  const roots = buildReplies(null);

  if (roots.length > 0) {
    return roots;
  }

  // Fallback for malformed payloads that mark every comment with a missing parent id.
  return Array.from(commentMap.values()).map((comment) => ({
    ...comment,
    replies: [],
  }));
}

function normalizeCommunityPostDetail(post: CommunityPostDetail): CommunityPostDetail {
  return {
    ...post,
    comments: Array.isArray(post.comments)
      ? buildCommunityCommentTree(post.comments)
      : [],
  };
}

function normalizePopularTopic(topic: PopularTopicApiResponse): PopularTopic {
  const reviewCount =
    typeof topic.reviewCount === "number" && Number.isFinite(topic.reviewCount)
      ? topic.reviewCount
      : 0;
  const reopenCount =
    typeof topic.reopenCount === "number" && Number.isFinite(topic.reopenCount)
      ? topic.reopenCount
      : 0;
  const popularityScore =
    typeof topic.popularityScore === "number" && Number.isFinite(topic.popularityScore)
      ? topic.popularityScore
      : reviewCount + reopenCount;
  const trend: TrendType =
    topic.trend === "up" || topic.trend === "down" || topic.trend === "steady"
      ? topic.trend
      : "steady";

  return {
    topicKey: topic.topicKey ?? "",
    topicText: topic.topicText ?? topic.topicKey ?? "",
    rank:
      typeof topic.rank === "number" && Number.isFinite(topic.rank)
        ? topic.rank
        : 0,
    popularityScore,
    reviewCount,
    reopenCount,
    trend,
    trendValue:
      typeof topic.trendValue === "number" && Number.isFinite(topic.trendValue)
        ? topic.trendValue
        : null,
    representativeReviewId: topic.representativeReviewId ?? "",
    updatedAt: topic.updatedAt ?? new Date(0).toISOString(),
  };
}

function normalizeNotificationPreferences(
  preferences: NotificationPreferencesResponse,
): NotificationPreferences {
  return {
    reviewCompleted: preferences.reviewCompleted,
    communityComment: preferences.communityComment,
    communityLike: preferences.communityLike,
  };
}

function normalizeNotificationsList(
  response: NotificationsListApiResponse,
): NotificationsListResponse {
  return {
    unreadCount: response.unreadCount,
    items: response.items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      isRead: item.isRead,
      createdAt: item.createdAt,
      targetType: item.targetType,
      targetId: item.targetId,
    })),
  };
}

export const api = {
  reviews: {
    getRecent: async (): Promise<ReviewPreviewSummary[]> => {
      const response = await apiRequest<ReviewPreviewSummaryResponse[]>(
        "/api/v1/reviews",
      );

      return response.map(mapReviewPreviewSummary);
    },
    create: async (
      claim: string,
      clientRequestId?: string,
    ): Promise<ReviewPreviewDetail> => {
      const response = await apiRequest<ReviewPreviewDetailResponse>(
        "/api/v1/reviews/query-processing-preview/async",
        {
          method: "POST",
          body: JSON.stringify({ claim, clientRequestId }),
        },
      );

      return mapReviewPreviewDetail(response);
    },
    getDetail: async (reviewId: string): Promise<ReviewPreviewDetail> => {
      const response = await apiRequest<ReviewPreviewDetailResponse>(
        `/api/v1/reviews/${encodeURIComponent(reviewId)}`,
      );

      return mapReviewPreviewDetail(response);
    },
    delete: async (reviewId: string): Promise<{ ok: true }> =>
      apiRequest<{ ok: true }>(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
        method: "DELETE",
      }),
    recordReopen: async (
      reviewId: string,
      source: ReviewEntrySource,
    ): Promise<{ ok: true }> =>
      apiRequest<{ ok: true }>(
        `/api/v1/reviews/${encodeURIComponent(reviewId)}/reopen`,
        {
          method: "POST",
          body: JSON.stringify({ source }),
        },
      ),
  },
  popular: {
    getTopics: async (): Promise<PopularTopic[]> => {
      const response = await apiRequest<PopularTopicApiResponse[]>(
        "/api/v1/popular/topics",
      );

      return response.map(normalizePopularTopic);
    },
  },
  notifications: {
    list: async (): Promise<NotificationsListResponse> =>
      normalizeNotificationsList(
        await apiRequest<NotificationsListApiResponse>("/api/v1/notifications"),
      ),
    markRead: async (notificationId: string): Promise<{ ok: true }> =>
      apiRequest<{ ok: true }>(
        `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
        {
          method: "POST",
        },
      ),
    markAllRead: async (): Promise<{ ok: true }> =>
      apiRequest<{ ok: true }>("/api/v1/notifications/read-all", {
        method: "POST",
      }),
    delete: async (notificationId: string): Promise<{ ok: true }> =>
      apiRequest<{ ok: true }>(
        `/api/v1/notifications/${encodeURIComponent(notificationId)}`,
        {
          method: "DELETE",
        },
      ),
    deleteAll: async (): Promise<{ ok: true }> =>
      apiRequest<{ ok: true }>("/api/v1/notifications/all", {
        method: "DELETE",
      }),
    getPreferences: async (): Promise<NotificationPreferences> =>
      normalizeNotificationPreferences(
        await apiRequest<NotificationPreferencesResponse>(
          "/api/v1/notifications/preferences",
        ),
      ),
    updatePreferences: async (
      payload: UpdateNotificationPreferencesPayload,
    ): Promise<NotificationPreferences> =>
      normalizeNotificationPreferences(
        await apiRequest<NotificationPreferencesResponse>(
          "/api/v1/notifications/preferences",
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        ),
      ),
  },
  community: {
    getPosts: async (): Promise<CommunityPost[]> =>
      apiRequest<CommunityPost[]>("/api/v1/community/posts"),
    getPostDetail: async (postId: string): Promise<CommunityPostDetail> =>
      normalizeCommunityPostDetail(
        await apiRequest<CommunityPostDetail>(
        `/api/v1/community/posts/${encodeURIComponent(postId)}`,
        ),
      ),
    createPost: async (
      payload: CreateCommunityPostPayload,
    ): Promise<CommunityPostDetail> =>
      normalizeCommunityPostDetail(
        await apiRequest<CommunityPostDetail>("/api/v1/community/posts", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      ),
    updatePost: async (
      postId: string,
      payload: UpdateCommunityPostPayload,
    ): Promise<CommunityPostDetail> =>
      normalizeCommunityPostDetail(
        await apiRequest<CommunityPostDetail>(
          `/api/v1/community/posts/${encodeURIComponent(postId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        ),
      ),
    deletePost: async (postId: string): Promise<void> =>
      apiRequest<void>(`/api/v1/community/posts/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        skipJson: true,
      }),
    createComment: async (
      postId: string,
      payload: CreateCommunityCommentPayload,
    ): Promise<CommunityPostDetail> =>
      normalizeCommunityPostDetail(
        await apiRequest<CommunityPostDetail>(
          `/api/v1/community/posts/${encodeURIComponent(postId)}/comments`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        ),
      ),
    deleteComment: async (
      postId: string,
      commentId: string,
    ): Promise<CommunityPostDetail> =>
      normalizeCommunityPostDetail(
        await apiRequest<CommunityPostDetail>(
          `/api/v1/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
          {
            method: "DELETE",
          },
        ),
      ),
    addLike: async (postId: string): Promise<CommunityLikeState> =>
      apiRequest<CommunityLikeState>(
        `/api/v1/community/posts/${encodeURIComponent(postId)}/likes`,
        {
          method: "POST",
        },
      ),
    removeLike: async (postId: string): Promise<CommunityLikeState> =>
      apiRequest<CommunityLikeState>(
        `/api/v1/community/posts/${encodeURIComponent(postId)}/likes`,
        {
          method: "DELETE",
        },
      ),
    addCommentLike: async (
      postId: string,
      commentId: string,
    ): Promise<Pick<CommunityComment, "likedByMe" | "likeCount">> =>
      apiRequest<Pick<CommunityComment, "likedByMe" | "likeCount">>(
        `/api/v1/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/likes`,
        {
          method: "POST",
        },
      ),
    removeCommentLike: async (
      postId: string,
      commentId: string,
    ): Promise<Pick<CommunityComment, "likedByMe" | "likeCount">> =>
      apiRequest<Pick<CommunityComment, "likedByMe" | "likeCount">>(
        `/api/v1/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/likes`,
        {
          method: "DELETE",
        },
      ),
  },
  auth: {
    getSession: async (): Promise<SessionResponse> =>
      apiRequest<SessionResponse>("/api/v1/auth/session"),
    logout: async (): Promise<void> =>
      apiRequest<void>("/api/v1/auth/logout", { method: "POST", skipJson: true }),
  },
  users: {
    getMe: async (): Promise<UserMeResponse> =>
      apiRequest<UserMeResponse>("/api/v1/users/me"),
    updateMyProfile: async (payload: UpdateProfilePayload): Promise<UserMeResponse> =>
      apiRequest<UserMeResponse>("/api/v1/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  },
};
