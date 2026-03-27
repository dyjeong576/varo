"use client";

import { X, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { NotificationList } from "./_components/notification-list";

export default function NotificationsPage() {
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  const handleMore = () => {
    // Placeholder for more actions
    console.log("More actions clicked");
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
        <button 
          onClick={handleMore}
          className="p-2 -mr-2 rounded-full hover:bg-[#e6e7f4] transition-colors active:scale-95 duration-150 text-[#424656]"
        >
          <MoreVertical className="w-6 h-6" />
        </button>
      </div>
      
      <main className="flex-1 overflow-y-auto">
        <NotificationList />
      </main>
    </div>
  );
}
