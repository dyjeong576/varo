import { api } from "@/lib/api/client";
import type { NotificationsListResponse } from "@/lib/notifications/types";
import { buildReviewEntryHref } from "@/lib/reviews/navigation";

const CHANGE_EVENT = "varo-notifications-changed";

type NotificationsSnapshot = NotificationsListResponse & {
  isLoaded: boolean;
  isLoading: boolean;
  errorMessage: string | null;
};

const DEFAULT_SNAPSHOT: NotificationsSnapshot = {
  items: [],
  unreadCount: 0,
  isLoaded: false,
  isLoading: false,
  errorMessage: null,
};

let notificationsSnapshot: NotificationsSnapshot = DEFAULT_SNAPSHOT;

function emitChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function setNotificationsSnapshot(nextSnapshot: NotificationsSnapshot): void {
  notificationsSnapshot = nextSnapshot;
  emitChange();
}

export function getNotificationsState(): NotificationsSnapshot {
  return notificationsSnapshot;
}

export function getNotifications(): NotificationsSnapshot["items"] {
  return notificationsSnapshot.items;
}

export function getUnreadNotificationCount(): number {
  return notificationsSnapshot.unreadCount;
}

export function getNotificationHref(params: {
  targetType: "review" | "community_post";
  targetId: string;
}): string {
  if (params.targetType === "review") {
    return buildReviewEntryHref(params.targetId, "notification");
  }

  return `/community/${encodeURIComponent(params.targetId)}`;
}

export async function refreshNotifications(): Promise<NotificationsListResponse> {
  if (!notificationsSnapshot.isLoaded) {
    setNotificationsSnapshot({
      ...notificationsSnapshot,
      isLoading: true,
      errorMessage: null,
    });
  }

  try {
    const response = await api.notifications.list();

    setNotificationsSnapshot({
      ...response,
      isLoaded: true,
      isLoading: false,
      errorMessage: null,
    });

    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알림 목록을 불러오지 못했습니다.";

    setNotificationsSnapshot({
      ...notificationsSnapshot,
      isLoaded: true,
      isLoading: false,
      errorMessage,
    });

    throw error;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.notifications.markRead(id);

  const nextItems = notificationsSnapshot.items.map((item) =>
    item.id === id
      ? {
          ...item,
          isRead: true,
        }
      : item,
  );
  const nextUnreadCount = nextItems.filter((item) => !item.isRead).length;

  setNotificationsSnapshot({
    ...notificationsSnapshot,
    items: nextItems,
    unreadCount: nextUnreadCount,
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.notifications.markAllRead();

  setNotificationsSnapshot({
    ...notificationsSnapshot,
    items: notificationsSnapshot.items.map((item) => ({
      ...item,
      isRead: true,
    })),
    unreadCount: 0,
  });
}

export function clearNotifications(): void {
  notificationsSnapshot = DEFAULT_SNAPSHOT;
  emitChange();
}

export function subscribeNotifications(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();

  window.addEventListener(CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}
