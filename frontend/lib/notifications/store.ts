import { AppNotification } from "@/lib/notifications/types";
import { buildReviewEntryHref } from "@/lib/reviews/navigation";
import { ReviewPreviewDetail } from "@/lib/reviews/types";

const STORAGE_KEY = "varo.notifications";
const CHANGE_EVENT = "varo-notifications-changed";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function readNotifications(): AppNotification[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is AppNotification =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as AppNotification).id === "string" &&
            typeof (item as AppNotification).type === "string" &&
            typeof (item as AppNotification).title === "string" &&
            typeof (item as AppNotification).message === "string" &&
            typeof (item as AppNotification).isRead === "boolean" &&
            typeof (item as AppNotification).createdAt === "string",
        ),
    );
  } catch {
    return [];
  }
}

function writeNotifications(notifications: AppNotification[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  emitChange();
}

export function getNotifications(): AppNotification[] {
  return readNotifications().sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function getUnreadNotificationCount(): number {
  return getNotifications().filter((notification) => !notification.isRead).length;
}

export function createReviewCompletionNotification(
  review: Pick<ReviewPreviewDetail, "reviewId" | "claim" | "currentStageLabel">,
): void {
  const notifications = readNotifications();

  if (notifications.some((notification) => notification.reviewId === review.reviewId)) {
    return;
  }

  const nextNotification: AppNotification = {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `notification:${Date.now()}`,
    reviewId: review.reviewId,
    type: "analysis",
    title: "근거 수집 완료",
    message: `"${review.claim}" review preview가 준비되었습니다.`,
    isRead: false,
    createdAt: new Date().toISOString(),
    link: buildReviewEntryHref(review.reviewId, "notification"),
  };

  writeNotifications([nextNotification, ...notifications].slice(0, 50));
}

export function markNotificationRead(id: string): void {
  writeNotifications(
    readNotifications().map((notification) =>
      notification.id === id
        ? {
            ...notification,
            isRead: true,
          }
        : notification,
    ),
  );
}

export function markAllNotificationsRead(): void {
  writeNotifications(
    readNotifications().map((notification) => ({
      ...notification,
      isRead: true,
    })),
  );
}

export function clearNotifications(): void {
  writeNotifications([]);
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
