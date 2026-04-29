"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  BellRing,
  Lock,
  HelpCircle,
  LogOut,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { clearNotificationPreferences } from "@/lib/notifications/preferences";
import { clearNotifications } from "@/lib/notifications/store";
import { clearAnswerTasks } from "@/lib/answers/task-store";

export function SettingsNav() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const sections = [
    {
      title: "계정",
      items: [
        { icon: <User className="w-5 h-5" />, label: "내 정보 관리", href: "/user-info" },
      ]
    },
    {
      title: "앱 설정",
      items: [
        { icon: <BellRing className="w-5 h-5" />, label: "알림 설정", href: "/settings/notifications" },
        { icon: <HelpCircle className="w-5 h-5" />, label: "고객 센터", href: "/settings/support" },
      ]
    }
  ];

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await api.auth.logout();
      clearAnswerTasks();
      clearNotifications();
      clearNotificationPreferences();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col space-y-8">
      {sections.map((section, idx) => (
        <div key={idx} className="flex flex-col">
          <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">{section.title}</h3>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {section.items.map((item, itemIdx) => (
              <Link 
                key={itemIdx} 
                href={item.href}
                className={`flex items-center justify-between p-4 px-5 active:bg-gray-50 transition-colors ${
                  itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-50 rounded-xl text-gray-600">
                    {item.icon}
                  </div>
                  <span className="text-[15px] font-semibold text-gray-800">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-4 px-1">
        {logoutError ? (
          <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {logoutError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-3 w-full p-4 rounded-2xl text-red-500 font-semibold hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:text-red-300 disabled:hover:bg-transparent"
        >
          {isLoggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogOut className="w-5 h-5" />
          )}
          <span className="text-[15px]">
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </span>
        </button>
      </div>
    </div>
  );
}
