export type VerdictState = "Likely True" | "Mixed Evidence" | "Unclear" | "Likely False";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  authProvider: string;
}

export interface SessionProfile {
  realName: string | null;
  gender: string | null;
  ageRange: string | null;
  country: string | null;
  city: string | null;
}

export interface SessionResponse {
  isAuthenticated: boolean;
  expiresAt: string | null;
  profileComplete: boolean;
  user: SessionUser | null;
  profile: SessionProfile | null;
}

export interface UserMeResponse {
  user: SessionUser;
  profile: SessionProfile;
  profileComplete: boolean;
}

export interface NotificationPreferencesResponse {
  answerCompleted: boolean;
  communityComment: boolean;
  communityLike: boolean;
}

export interface NotificationItemResponse {
  id: string;
  type: "answer_completed" | "community_comment" | "community_like";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  targetType: "answer" | "community_post";
  targetId: string;
}

export interface NotificationsListApiResponse {
  items: NotificationItemResponse[];
  unreadCount: number;
}

export interface UpdateProfilePayload {
  realName?: string;
  gender?: string;
  ageRange?: string;
  country?: string;
  city?: string;
}

export interface UpdateNotificationPreferencesPayload {
  answerCompleted?: boolean;
  communityComment?: boolean;
  communityLike?: boolean;
}

export interface Answer {
  id: string;
  check: string;
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
