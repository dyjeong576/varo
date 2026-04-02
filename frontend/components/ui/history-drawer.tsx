"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Settings, History } from "lucide-react";
import { api } from "@/lib/api/client";
import { APP_NAME, APP_TAGLINE } from "@/lib/config/app";
import { ReviewPreviewSummary } from "@/lib/reviews/types";
import { getMergedReviewSummaries } from "@/lib/reviews/history";
import { subscribeReviewTasks } from "@/lib/reviews/task-store";
import { ReviewHistoryList } from "@/components/reviews/ReviewHistoryList";

export function HistoryDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [reviews, setReviews] = useState<ReviewPreviewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const openDrawer = () => {
    setIsLoading(true);
    setIsOpen(true);
  };

  useEffect(() => {
    return subscribeReviewTasks(() => {
      if (!isOpen) {
        return;
      }

      void getMergedReviewSummaries(api.reviews.getRecent).then((result) => {
        setReviews(result);
      });
    });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      getMergedReviewSummaries(api.reviews.getRecent).then((res) => {
        setReviews(res);
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
          <div>
            <h2 className="text-xl font-black tracking-tight text-primary">{APP_NAME}</h2>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              {APP_TAGLINE}
            </p>
          </div>
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
          <Link href="/history" className="flex items-center gap-4 px-6 py-[18px] hover:bg-gray-50 text-gray-700 transition-colors" onClick={() => setIsOpen(false)}>
            <History className="w-5 h-5 text-gray-400" />
            <span className="font-semibold text-[15px]">히스토리</span>
          </Link>
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
            {APP_NAME}가 최근 검토한 이슈들의 리포트입니다. 각 항목을 열어 출처와 판단 맥락을 확인하세요.
          </p>

          <ReviewHistoryList
            reviews={reviews}
            isLoading={isLoading}
            onNavigate={() => setIsOpen(false)}
          />
        </div>

        {/* Footer Callout */}
        <div className="p-6 bg-[#F8FAFC] mt-auto border-t border-gray-100 shrink-0">
          <h4 className="text-[12px] font-extrabold text-gray-800 mb-1.5 tracking-tight">{APP_TAGLINE}</h4>
          <p className="text-[11px] text-gray-500 break-keep leading-relaxed">
            {APP_NAME}는 단정적인 결론보다 출처와 근거를 먼저 비교할 수 있는 경험을 지향합니다.
          </p>
        </div>
      </div>
    </>
  );
}
