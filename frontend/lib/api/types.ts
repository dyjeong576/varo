export type VerdictState = "Likely True" | "Mixed Evidence" | "Unclear" | "Likely False";

export interface Review {
  id: string;
  claim: string;
  verdict: VerdictState | null; // null if pending or partial
  createdAt: string;
}

export interface UserAuthor {
  name: string;
  gender: string; // "남", "여" 등 한글 대응
  ageGroup: string; // 예: "30대", "20대"
}

export type CommunityCategory = 'Issue' | 'Policy' | 'FactCheck';

export interface Comment {
  id: string;
  author: UserAuthor;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  category: CommunityCategory;
  author: UserAuthor;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  comments?: Comment[];
}

export interface MockApiResponse<T> {
  data: T;
  status: number;
}
