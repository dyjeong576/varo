"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Bell, Home, TrendingUp, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryDrawer } from "@/components/ui/history-drawer";
import { APP_NAME } from "@/lib/config/app";
import {
  getUnreadNotificationCount,
  subscribeNotifications,
} from "@/lib/notifications/store";

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNotificationsPage = pathname === "/notifications";
  const unreadNotificationCount = useSyncExternalStore(
    subscribeNotifications,
    getUnreadNotificationCount,
    () => 0,
  );

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {!isNotificationsPage && (
        <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-[100] px-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-1">
            <HistoryDrawer />
            <Link href="/" className="flex items-center -ml-1 active:scale-95 transition-transform duration-150">
              <Image
                src="/logo/brand_logo.png"
                alt={`${APP_NAME} logo`}
                width={87}
                height={32}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>
          </div>
          <div className="flex items-center">
            <Link
              href="/notifications"
              className="p-3 -mr-3 text-gray-700 hover:bg-gray-100 rounded-full transition-all active:scale-95 duration-150 cursor-pointer flex items-center justify-center relative z-[110]"
              aria-label="알림"
            >
              <Bell className="w-6 h-6" />
              {unreadNotificationCount > 0 ? (
                <div className="absolute top-2.5 right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 border-2 border-white text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </div>
              ) : null}
            </Link>
          </div>
        </header>
      )}

      <main className={`flex-1 flex flex-col ${!isNotificationsPage ? "mt-14" : ""} mb-16 overflow-y-auto`}>
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 z-50 flex items-center justify-around px-2 pb-safe shadow-sm">
        <Link href="/" className={`flex flex-col items-center justify-center w-full h-full ${pathname === "/" ? "text-primary" : "text-gray-400 hover:text-gray-900 transition-colors"}`}>
          <Home className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-semibold">홈</span>
        </Link>
        <Link href="/popular" className={`flex flex-col items-center justify-center w-full h-full ${pathname === "/popular" ? "text-primary" : "text-gray-400 hover:text-gray-900 transition-colors"}`}>
          <TrendingUp className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-semibold">인기</span>
        </Link>
        <Link href="/community" className={`flex flex-col items-center justify-center w-full h-full ${pathname?.startsWith("/community") ? "text-primary" : "text-gray-400 hover:text-gray-900 transition-colors"}`}>
          <MessageSquare className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-semibold">커뮤니티</span>
        </Link>
      </nav>
    </div>
  );
}
