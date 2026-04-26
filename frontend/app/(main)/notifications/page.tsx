"use client";

import { useState } from "react";
import { X, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteAllNotifications } from "@/lib/notifications/store";
import { NotificationList } from "./_components/notification-list";

export default function NotificationsPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleClose = () => {
    router.back();
  };

  const handleDeleteAll = async () => {
    setIsMenuOpen(false);

    if (!window.confirm("알림을 모두 삭제하시겠습니까?")) {
      return;
    }

    try {
      await deleteAllNotifications();
    } catch (error) {
      console.error("Failed to delete all notifications:", error);
    }
  };

  const handleOpenSettings = () => {
    setIsMenuOpen(false);
    router.push("/settings/notifications");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#faf8ff]">
      {/* 
        Note: The main layout already has a header. 
        We are adding a page-specific header here to match the Stitch design.
      */}
      <div className="bg-[#faf8ff] sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleClose}
            className="p-2 -ml-2 rounded-full hover:bg-[#e6e7f4] transition-colors active:scale-95 duration-150 text-[#424656]"
          >
            <X className="w-6 h-6" />
          </button>
          <h1 className="font-bold tracking-tight text-[#191b24] text-xl">Notifications</h1>
        </div>
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen((current) => !current)}
            className="p-2 -mr-2 rounded-full hover:bg-[#e6e7f4] transition-colors active:scale-95 duration-150 text-[#424656]"
          >
            <MoreVertical className="w-6 h-6" />
          </button>
          {isMenuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-36 overflow-hidden rounded-2xl border border-[#e6e7f4] bg-white py-1 shadow-[0_16px_40px_rgba(25,27,36,0.14)]">
              <button
                type="button"
                onClick={() => {
                  void handleDeleteAll();
                }}
                className="flex w-full items-center px-4 py-3 text-left text-sm font-medium text-[#c43232] hover:bg-[#fff6f6]"
              >
                모두 삭제
              </button>
              <button
                type="button"
                onClick={handleOpenSettings}
                className="flex w-full items-center px-4 py-3 text-left text-sm font-medium text-[#191b24] hover:bg-[#f6f7fb]"
              >
                설정
              </button>
            </div>
          ) : null}
        </div>
      </div>
      
      <main className="flex-1 overflow-y-auto">
        <NotificationList />
      </main>
    </div>
  );
}
