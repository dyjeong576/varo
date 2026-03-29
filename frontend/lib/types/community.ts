export type CommunityCategory = "Issue" | "Policy" | "FactCheck";

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
}

export interface CommunityComment {
  id: string;
  postId: string;
  author: CommunityAuthor;
  content: string;
  createdAt: string;
}
