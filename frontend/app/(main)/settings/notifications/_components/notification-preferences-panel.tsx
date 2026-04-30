"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BellRing, Heart, MessageSquareText } from "lucide-react";
import {
  getDefaultNotificationPreferences,
  getNotificationPreferences,
  getNotificationPreferencesState,
  refreshNotificationPreferences,
  subscribeNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications/preferences";
import type { NotificationPreferences } from "@/lib/notifications/types";

interface PreferenceItem {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: typeof BellRing;
}

const preferenceItems: PreferenceItem[] = [
  {
    key: "answerCompleted",
    title: "answer 완료 알림",
    description: "요청한 answer가 준비되면 알림 목록과 상단 배지로 알려드려요.",
    icon: BellRing,
  },
  {
    key: "communityComment",
    title: "커뮤니티 댓글 알림",
    description: "내 게시글에 새 댓글이 달리거나 내 댓글에 답글이 달리면 알려드려요.",
    icon: MessageSquareText,
  },
  {
    key: "communityLike",
    title: "커뮤니티 좋아요 알림",
    description: "내 게시글이나 댓글에 좋아요가 눌리면 알려드려요.",
    icon: Heart,
  },
];

function PreferenceToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
        checked ? "bg-[#0050cb]" : "bg-[#d8d9e6]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function NotificationPreferencesPanel() {
  const preferencesState = useSyncExternalStore(
    subscribeNotificationPreferences,
    getNotificationPreferencesState,
    getNotificationPreferencesState,
  );
  const preferences = useSyncExternalStore(
    subscribeNotificationPreferences,
    getNotificationPreferences,
    getDefaultNotificationPreferences,
  );

  useEffect(() => {
    void refreshNotificationPreferences().catch(() => undefined);
  }, []);

  const togglePreference = async (key: keyof NotificationPreferences) => {
    await updateNotificationPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  if (preferencesState.isLoading && !preferencesState.isLoaded) {
    return (
      <div className="space-y-5">
        <section className="rounded-3xl border border-[#c2c6d8]/20 bg-white p-5 shadow-sm">
          <div className="h-4 w-28 animate-pulse rounded bg-[#ecedfa]" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-[#f2f3ff]" />
          <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-[#f2f3ff]" />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {preferencesState.errorMessage ? (
        <section className="rounded-3xl border border-[#ffd7d7] bg-[#fff6f6] p-5 text-sm text-[#b42318]">
          {preferencesState.errorMessage}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-[#c2c6d8]/20 bg-white shadow-sm">
        {preferenceItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <div
              key={item.key}
              className={`flex items-start gap-4 px-5 py-5 ${
                index < preferenceItems.length - 1 ? "border-b border-[#eef0f8]" : ""
              }`}
            >
              <div className="rounded-2xl bg-[#f2f3ff] p-3 text-[#0050cb]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-[#191b24]">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#5b6170]">{item.description}</p>
              </div>
              <PreferenceToggle
                checked={preferences[item.key]}
                onChange={() => {
                  void togglePreference(item.key);
                }}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}
