import { api } from "@/lib/api/client";
import type { NotificationPreferences } from "@/lib/notifications/types";

const CHANGE_EVENT = "varo-notification-preferences-changed";

type NotificationPreferencesSnapshot = {
  preferences: NotificationPreferences;
  isLoaded: boolean;
  isLoading: boolean;
  errorMessage: string | null;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  answerCompleted: true,
  communityComment: true,
  communityLike: true,
};

const DEFAULT_SNAPSHOT: NotificationPreferencesSnapshot = {
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  isLoaded: false,
  isLoading: false,
  errorMessage: null,
};

let preferencesSnapshot: NotificationPreferencesSnapshot = DEFAULT_SNAPSHOT;

function emitChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function setPreferencesSnapshot(nextSnapshot: NotificationPreferencesSnapshot): void {
  preferencesSnapshot = nextSnapshot;
  emitChange();
}

export function getDefaultNotificationPreferences(): NotificationPreferences {
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export function getNotificationPreferencesState(): NotificationPreferencesSnapshot {
  return preferencesSnapshot;
}

export function getNotificationPreferences(): NotificationPreferences {
  return preferencesSnapshot.preferences;
}

export async function refreshNotificationPreferences(): Promise<NotificationPreferences> {
  if (!preferencesSnapshot.isLoaded) {
    setPreferencesSnapshot({
      ...preferencesSnapshot,
      isLoading: true,
      errorMessage: null,
    });
  }

  try {
    const preferences = await api.notifications.getPreferences();

    setPreferencesSnapshot({
      preferences,
      isLoaded: true,
      isLoading: false,
      errorMessage: null,
    });

    return preferences;
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알림 설정을 불러오지 못했습니다.";

    setPreferencesSnapshot({
      ...preferencesSnapshot,
      isLoaded: true,
      isLoading: false,
      errorMessage,
    });

    throw error;
  }
}

export async function updateNotificationPreferences(
  nextPreferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const preferences = await api.notifications.updatePreferences(nextPreferences);

  setPreferencesSnapshot({
    preferences,
    isLoaded: true,
    isLoading: false,
    errorMessage: null,
  });

  return preferences;
}

export function clearNotificationPreferences(): void {
  preferencesSnapshot = DEFAULT_SNAPSHOT;
  emitChange();
}

export function subscribeNotificationPreferences(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();

  window.addEventListener(CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}
