"use client";

import { CommunityCategory } from "@/lib/types/community";

interface CategorySelectorProps {
  selectedCategory: CommunityCategory | null;
  onSelect: (category: CommunityCategory) => void;
}

const categories: { label: string; value: CommunityCategory }[] = [
  { label: "현안 토론", value: "Issue" },
  { label: "정책 제언", value: "Policy" },
  { label: "팩트체크 제보", value: "FactCheck" },
  { label: "자유 게시판", value: "General" },
];

export function CategorySelector({ selectedCategory, onSelect }: CategorySelectorProps) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <p className="mb-3 ml-1 text-[13px] font-bold uppercase tracking-wider text-[#727687]">
        카테고리 선택
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
              selectedCategory === cat.value
                ? "bg-[#0050cb] text-white border-[#0050cb] shadow-md shadow-[#0050cb]/20"
                : "bg-white text-[#424656] border-[#f2f3ff] hover:bg-[#f2f3ff]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
