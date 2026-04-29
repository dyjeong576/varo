export type NotificationType =
  | "answer_completed"
  | "community_comment"
  | "community_like";

export type NotificationTargetType = "answer" | "community_post";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  targetType: NotificationTargetType;
  targetId: string;
}

export interface NotificationPreferences {
  answerCompleted: boolean;
  communityComment: boolean;
  communityLike: boolean;
}

export interface NotificationsListResponse {
  items: NotificationItem[];
  unreadCount: number;
}
