"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { NotificationItem } from "@/lib/notifications/types";
import {
  deleteNotification,
  getNotificationHref,
  getNotifications,
  getNotificationsState,
  markAllNotificationsRead,
  markNotificationRead,
  refreshNotifications,
  subscribeNotifications,
} from "@/lib/notifications/store";
import {
  FileCheck, 
  Heart,
  MessageSquare, 
  Bell, 
  ArrowRight, 
  Sparkles,
  Check,
  X
} from "lucide-react";

export function NotificationList() {
  const notificationsState = useSyncExternalStore(
    subscribeNotifications,
    getNotificationsState,
    getNotificationsState,
  );
  const notifications = getNotifications();

  useEffect(() => {
    void refreshNotifications().catch(() => undefined);
  }, []);

  const getIcon = (type: NotificationItem["type"], isRead: boolean) => {
    switch(type) {
      case "review_completed":
        return <FileCheck className={`w-6 h-6 ${isRead ? 'text-gray-400' : 'text-blue-600'}`} />;
      case "community_comment":
        return <MessageSquare className={`w-6 h-6 ${isRead ? 'text-gray-400' : 'text-slate-600'}`} />;
      case "community_like":
        return <Heart className={`w-6 h-6 ${isRead ? 'text-gray-400' : 'text-slate-600'}`} />;
      default:
        return <Check className={`w-6 h-6 ${isRead ? 'text-gray-400' : 'text-gray-600'}`} />;
    }
  };

  const getIconBg = (type: NotificationItem["type"], isRead: boolean) => {
    if (isRead) return "bg-[#ecedfa]";
    switch(type) {
      case "review_completed":
        return "bg-[#dae1ff]";
      case "community_comment":
      case "community_like":
        return "bg-[#d6e3fb]";
      default:
        return "bg-[#ecedfa]";
    }
  };

  const getTimeLabel = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    return `${diffDays}일 전`;
  };

  const markAllAsRead = async () => {
    await markAllNotificationsRead();
  };

  if (notificationsState.isLoading && !notificationsState.isLoaded) {
    return (
      <div className="flex flex-col space-y-1 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse px-6 py-4 flex gap-4 bg-white">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gray-100"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notificationsState.errorMessage) {
    return (
      <div className="px-6 py-10">
        <div className="rounded-3xl border border-[#ffd7d7] bg-[#fff6f6] px-5 py-4 text-sm text-[#b42318]">
          {notificationsState.errorMessage}
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-50 flex items-center justify-center">
          <Bell className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700">새로운 알림이 없습니다</h3>
        <p className="text-xs text-gray-400 mt-2">검증이 완료되거나 새로운 소식이 있으면<br/>이곳에서 알려드릴게요.</p>
      </div>
    );
  }

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const readNotifications = notifications.filter(n => n.isRead);

  const renderNotificationItem = (notif: NotificationItem) => {
    const content = (
      <Link
        href={getNotificationHref({
          targetType: notif.targetType,
          targetId: notif.targetId,
        })}
        className="flex min-w-0 flex-1 gap-4"
        onClick={() => {
          void markNotificationRead(notif.id);
        }}
      >
        <div className={`relative flex-shrink-0 w-12 h-12 rounded-2xl ${getIconBg(notif.type, notif.isRead)} flex items-center justify-center`}>
          {getIcon(notif.type, notif.isRead)}
          {!notif.isRead && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#0066ff] border-2 border-white rounded-full"></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <h3 className={`text-[15px] font-bold ${notif.isRead ? 'text-[#424656]' : 'text-[#191b24]'} truncate`}>
              {notif.title}
            </h3>
            <span className="text-[12px] text-[#424656] whitespace-nowrap ml-2">
              {getTimeLabel(notif.createdAt)}
            </span>
          </div>
          <p className={`text-[14px] leading-relaxed line-clamp-2 ${notif.isRead ? 'text-[#424656]/70' : 'text-[#424656]'}`}>
            {notif.message}
          </p>
        </div>
      </Link>
    );

    const itemClasses = `group px-6 py-4 flex items-start gap-3 transition-colors duration-150 ${
      notif.isRead ? 'bg-[#faf8ff] opacity-70' : 'bg-white'
    } hover:bg-[#f2f3ff]`;

    return (
      <div
        key={notif.id}
        className={itemClasses}
      >
        {content}
        <button
          type="button"
          aria-label="알림 삭제"
          onClick={() => {
            void deleteNotification(notif.id).catch((error) => {
              console.error("Failed to delete notification:", error);
            });
          }}
          className="mt-0.5 rounded-full p-1.5 text-[#727687] transition-colors hover:bg-white hover:text-[#191b24]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col pb-24">
      {/* Section: Unread */}
      {unreadNotifications.length > 0 && (
        <section className="mt-4">
          <div className="px-6 py-3 flex justify-between items-center">
            <h2 className="text-sm font-bold text-[#0050cb] tracking-wide uppercase">읽지 않음</h2>
            <button 
              onClick={() => {
                void markAllAsRead();
              }}
              className="text-[12px] text-[#424656] hover:text-[#0050cb] transition-colors font-medium"
            >
              모두 읽음
            </button>
          </div>
          <div className="space-y-1">
            {unreadNotifications.map(renderNotificationItem)}
          </div>
        </section>
      )}

      {/* Section Divider */}
      <div className="h-2 bg-[#f2f3ff] my-2"></div>

      {/* Section: Previous */}
      <section>
        <div className="px-6 py-3">
          <h2 className="text-sm font-bold text-[#424656] tracking-wide uppercase">이전 알림</h2>
        </div>
        <div className="space-y-1">
          {readNotifications.map(renderNotificationItem)}
          
          {/* Editorial Card: Weekly Summary */}
          <div className="px-6 mt-8">
            <div className="bg-[#f2f3ff] rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#0050cb]/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
              <h4 className="text-xs font-bold text-[#0050cb] mb-2 flex items-center gap-1 uppercase tracking-widest text-[10px]">
                <Sparkles className="w-3.5 h-3.5" />
                Weekly Summary
              </h4>
              <p className="text-[#191b24] font-semibold text-lg leading-snug mb-4">
                이번 주 가장 많이 확인된<br/>뉴스 키워드를 확인해보세요
              </p>
              <button className="bg-[#0050cb] text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-[#0050cb]/20 flex items-center gap-2 hover:opacity-90 transition-all active:scale-95">
                리포트 보기
                <ArrowRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
