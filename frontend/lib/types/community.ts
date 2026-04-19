export type CommunityCategory = "Issue" | "Policy" | "FactCheck" | "General";

export interface CommunityAuthor {
  name: string;
  gender: string;
  ageGroup: string;
  avatarUrl?: string;
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  category: CommunityCategory;
  author: CommunityAuthor;
  commentCount: number;
  likeCount: number;
  createdAt: string;
  isAuthor: boolean;
  likedByMe: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  author: CommunityAuthor;
  content: string;
  createdAt: string;
  isAuthor: boolean;
  likeCount: number;
  likedByMe: boolean;
  replies: CommunityComment[];
}

export interface CommunityPostDetail extends CommunityPost {
  comments: CommunityComment[];
}

export interface CommunityLikeState {
  likedByMe: boolean;
  likeCount: number;
}

export interface CreateCommunityPostPayload {
  category: CommunityCategory;
  title: string;
  content: string;
}

export interface UpdateCommunityPostPayload {
  category?: CommunityCategory;
  title?: string;
  content?: string;
}

export interface CreateCommunityCommentPayload {
  content: string;
  parentCommentId?: string;
}
