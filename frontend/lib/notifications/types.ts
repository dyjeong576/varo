export type AppNotificationType = "analysis" | "community" | "system";

export interface AppNotification {
  id: string;
  reviewId?: string;
  type: AppNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}
