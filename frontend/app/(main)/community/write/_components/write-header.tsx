"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";

interface WriteHeaderProps {
  title?: string;
  submitLabel?: string;
  onPublish: () => void;
  isPublishDisabled: boolean;
}

export function WriteHeader({
  title = "글쓰기",
  submitLabel = "등록",
  onPublish,
  isPublishDisabled,
}: WriteHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 border-b border-[#f2f3ff] bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-[#424656] hover:bg-[#f2f3ff] rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h1 className="text-[17px] font-bold text-[#191b24]">{title}</h1>

        <button
          onClick={onPublish}
          disabled={isPublishDisabled}
          className={`rounded-full px-4 py-1.5 text-[15px] font-bold transition-all ${
            isPublishDisabled
              ? "cursor-not-allowed bg-[#f2f3ff] text-[#727687]"
              : "bg-[#0066ff] text-white shadow-sm active:scale-95"
          }`}
        >
          {submitLabel}
        </button>
      </div>
    </header>
  );
}
