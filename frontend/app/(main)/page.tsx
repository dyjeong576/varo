"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";

export default function HomePage() {
  const [claim, setClaim] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 1. API Call 모의 처리
      await api.reviews.create(claim);
      // 2. URL 파라미터로 검색 결과 페이지로 연결
      router.push(`/loading?q=${encodeURIComponent(claim)}`);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false); // 실패 시 초기화
    }
  };

  return (
    <div className="flex flex-col items-center px-6 pt-12 pb-8 flex-1 bg-white font-sans w-full">
      
      {/* 타이틀 및 설명 영역 */}
      <div className="flex flex-col items-center text-center w-full max-w-md mb-10 mt-4">
        <h1 className="text-[26px] font-bold text-gray-900 mb-3 tracking-tight break-keep leading-tight">
          진실을 여는 가장 명확한 방법
        </h1>
        <p className="mb-4 text-[15px] font-semibold text-primary break-keep">
          검증된 데이터를 통해 세상의 궁금증을 해결합니다
        </p>
        <p className="text-[13px] text-gray-500 break-keep leading-relaxed max-w-[90%]">
          VARO는 수집된 출처와 구조화된 요약을 바탕으로 판단에 필요한 맥락을 정리합니다.
        </p>
      </div>

      {/* 입력 영역 */}
      <div className="w-full max-w-md flex flex-col justify-center mt-auto mb-8">
        <form onSubmit={handleSearch} className="w-full flex justify-center">
          <div className={`relative w-full shadow-[0_2px_18px_rgba(0,0,0,0.06)] rounded-3xl group transition-all duration-300 focus-within:shadow-[0_4px_24px_rgba(37,99,235,0.12)] border border-gray-100 bg-white ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}>
            <textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              disabled={isSubmitting}
              placeholder="검증하고 싶은 소문, 뉴스, 주장을 입력하세요..."
              className="w-full rounded-3xl bg-transparent px-5 py-5 min-h-[140px] resize-none text-[15px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!claim.trim() || isSubmitting}
              className="absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-md disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-colors active:bg-blue-700"
              aria-label="분석 시작"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
