"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, MapPin } from "lucide-react";
import {
  createAnswerTask,
  getActiveAnswerTask,
  startAnswerTask,
  subscribeAnswerTasks,
} from "@/lib/answers/task-store";

export default function HomePage() {
  const [check, setCheck] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const activeTask = useSyncExternalStore(
    subscribeAnswerTasks,
    getActiveAnswerTask,
    () => null,
  );

  useEffect(() => {
    if (activeTask) {
      router.replace(`/loading?draft=${encodeURIComponent(activeTask.draftId)}`);
    }
  }, [activeTask, router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!check.trim() || isSubmitting) return;

    const normalizedCheck = check.trim();
    const activeTask = getActiveAnswerTask();

    if (activeTask) {
      router.push(`/loading?draft=${encodeURIComponent(activeTask.draftId)}`);
      return;
    }

    setIsSubmitting(true);

    const draftId = createAnswerTask(normalizedCheck);
    void startAnswerTask(draftId);

    router.push(`/loading?draft=${encodeURIComponent(draftId)}`);
  };

  if (activeTask) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white px-6">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

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
          VARO는 복잡한 정보를 구조화된 인사이트로 정리해, 빠르고 정확한 판단을 돕습니다.
        </p>
        <div className="mt-5 inline-flex max-w-[92%] items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3.5 py-2 text-[12px] font-bold leading-snug text-blue-700 shadow-[0_6px_20px_rgba(37,99,235,0.08)]">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="break-keep">
            현재 VARO는 한국 경제와 뉴스 시장 분석에 집중하고 있습니다.
          </span>
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="w-full max-w-md flex flex-col justify-center mt-auto mb-8">
        <form onSubmit={handleSearch} className="w-full flex justify-center">
          <div className={`relative w-full shadow-[0_2px_18px_rgba(0,0,0,0.06)] rounded-3xl group transition-all duration-300 focus-within:shadow-[0_4px_24px_rgba(37,99,235,0.12)] border border-gray-100 bg-white ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}>
            <textarea
              value={check}
              onChange={(e) => setCheck(e.target.value)}
              disabled={isSubmitting}
              placeholder="검증하고 싶은 소문, 뉴스, 주장을 입력하세요..."
              className="w-full rounded-3xl bg-transparent px-5 py-5 min-h-[140px] resize-none text-[15px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!check.trim() || isSubmitting}
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
