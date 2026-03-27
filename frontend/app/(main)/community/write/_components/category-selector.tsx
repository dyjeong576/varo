"use client";

import { CommunityCategory } from "@/lib/api/types";

interface CategorySelectorProps {
  selectedCategory: CommunityCategory | null;
  onSelect: (category: CommunityCategory) => void;
}

const categories: { label: string; value: CommunityCategory }[] = [
  { label: "현안 토론", value: "Issue" },
  { label: "정책 제언", value: "Policy" },
  { label: "팩트체크 제보", value: "FactCheck" },
];

export function CategorySelector({ selectedCategory, onSelect }: CategorySelectorProps) {
  return (
    <div className="px-4 py-6">
      <p className="text-[13px] font-bold text-[#727687] mb-3 ml-1 uppercase tracking-wider">카테고리 선택</p>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
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
