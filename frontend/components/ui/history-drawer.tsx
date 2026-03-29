"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Settings, Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { Review } from "@/lib/api/types";

export function HistoryDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const openDrawer = () => {
    setIsLoading(true);
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      api.reviews.getRecent().then((res) => {
        setReviews(res.data);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  return (
    <>
      <button
        onClick={openDrawer}
        className="p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors" 
        aria-label="메뉴 열기"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-[60] transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sliding Panel */}
      <div 
        className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white z-[70] transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-black tracking-tight text-primary">VARO</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-700 rounded-full transition-colors"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="py-2 shrink-0">
          <Link href="/settings" className="flex items-center gap-4 px-6 py-[18px] hover:bg-gray-50 text-gray-700 transition-colors" onClick={() => setIsOpen(false)}>
            <Settings className="w-5 h-5 text-gray-400" />
            <span className="font-semibold text-[15px]">설정</span>
          </Link>
        </div>

        <div className="h-2 bg-gray-50 border-y border-gray-100 shrink-0" />

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">최근 검증 리포트</h3>
          <p className="text-[12px] text-gray-500 mb-5 break-keep leading-relaxed">
            VARO가 최근 검토한 이슈들의 리포트입니다. 각 항목을 열어 출처와 판단 맥락을 확인하세요.
          </p>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center p-4 text-sm text-gray-400 font-medium">데이터가 없습니다.</div>
            ) : (
              reviews.map((review) => {
                const getVerdictBadge = (verdict: string | null) => {
                  if (!verdict) return null;
                  if (verdict === "Likely False") {
                    return <div className="inline-flex mt-2 items-center px-2 py-1 rounded-md bg-red-50 text-red-600 border border-red-100 text-[11px] font-bold tracking-tight">대체로 허위</div>;
                  }
                  if (verdict === "Likely True") {
                    return <div className="inline-flex mt-2 items-center px-2 py-1 rounded-md bg-green-50 text-green-600 border border-green-100 text-[11px] font-bold tracking-tight">대체로 사실</div>;
                  }
                  if (verdict === "Mixed Evidence") {
                    return <div className="inline-flex mt-2 items-center px-2 py-1 rounded-md bg-orange-50 text-orange-600 border border-orange-100 text-[11px] font-bold tracking-tight">상충되는 근거</div>;
                  }
                  return <div className="inline-flex mt-2 items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 border border-gray-200 text-[11px] font-bold tracking-tight">판별 불가</div>;
                };

                return (
                  <Link key={review.id} href={`/reviews/${review.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-blue-50/30" onClick={() => setIsOpen(false)}>
                    <h4 className="text-[14px] font-bold text-gray-800 break-keep leading-[1.4]">
                      {review.claim}
                    </h4>
                    {getVerdictBadge(review.verdict)}
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Callout */}
        <div className="p-6 bg-[#F8FAFC] mt-auto border-t border-gray-100 shrink-0">
          <h4 className="text-[12px] font-extrabold text-gray-800 mb-1.5 tracking-tight">데이터로 증명하는 진실</h4>
          <p className="text-[11px] text-gray-500 break-keep leading-relaxed">
            VARO는 단정적인 결론보다, 출처와 근거를 먼저 비교할 수 있는 경험을 지향합니다.
          </p>
        </div>
      </div>
    </>
  );
}
