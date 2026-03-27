"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";

interface WriteHeaderProps {
  onPublish: () => void;
  isPublishDisabled: boolean;
}

export function WriteHeader({ onPublish, isPublishDisabled }: WriteHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 bg-white z-50 px-4 h-14 border-b border-[#f2f3ff] flex items-center justify-between">
      <button 
        onClick={() => router.back()}
        className="p-2 -ml-2 text-[#424656] hover:bg-[#f2f3ff] rounded-full transition-colors"
      >
        <X className="w-6 h-6" />
      </button>
      
      <h1 className="text-[17px] font-bold text-[#191b24]">글쓰기</h1>

      <button
        onClick={onPublish}
        disabled={isPublishDisabled}
        className={`text-[15px] font-bold px-4 py-1.5 rounded-full transition-all ${
          isPublishDisabled 
            ? "text-[#727687] bg-[#f2f3ff] cursor-not-allowed" 
            : "text-white bg-[#0066ff] active:scale-95 shadow-sm"
        }`}
      >
        등록
      </button>
    </header>
  );
}
