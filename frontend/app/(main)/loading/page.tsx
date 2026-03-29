"use client";

import { useEffect, useState, Suspense } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

const STAGES = [
  "준비 중",
  "데이터 서버 연결 완료",
  "기사 수집 중",
  "소셜 정리 중",
  "커뮤니티 반응 분석 대기",
  "시각화 생성 중",
  "신뢰 지수 산출 대기"
];

function LoadingContent() {
  const [currentStage, setCurrentStage] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimQuery = searchParams.get("q") || "입력된 주장 분석 중...";

  // 단계별 트래커 시뮬레이션을 위한 mock 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev < STAGES.length - 1) return prev + 1;
        clearInterval(timer);
        
        // 분석 완료 후 결과 페이지로 이동 (약 1초 뒤)
        setTimeout(() => {
          router.push(`/reviews/mock-1`);
        }, 1000);
        
        return prev;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex flex-col min-h-full px-6 pt-8 pb-8 bg-[#F8FAFC] font-sans">
      
      {/* 상단 헤더 영역 */}
      <div className="mb-10 text-center mt-2">
        <h1 className="text-[22px] font-extrabold text-gray-900 mb-2">
          팩트체크 분석 중
        </h1>
        <h2 className="text-[15px] font-bold text-primary break-keep">
          {claimQuery}
        </h2>
        <p className="mt-4 text-[13px] text-gray-500">
          신뢰할 수 있는 정보를 위해 다각도로 검증 중입니다.
        </p>
      </div>

      {/* 검증 진행 트래커 */}
      <div className="w-full max-w-sm mx-auto bg-white rounded-[20px] p-6 mb-8 shadow-sm border border-gray-100/60">
        <div className="space-y-[22px]">
          {STAGES.map((stage, index) => {
            const isCompleted = index < currentStage;
            const isCurrent = index === currentStage;

            return (
              <div key={index} className="flex items-center">
                {isCompleted ? (
                  <CheckCircle2 className="w-[18px] h-[18px] text-green-500 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary" />
                ) : (
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-200 shrink-0" />
                )}
                
                <span className={`ml-4 text-[14px] font-semibold tracking-tight ${
                  isCompleted ? "text-gray-900" :
                  isCurrent ? "text-primary" :
                  "text-gray-300"
                }`}>
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Curator Insights */}
      <div className="w-full max-w-sm mx-auto mb-6">
        <h3 className="text-[11px] font-extrabold text-gray-400 mb-3 px-1 tracking-wider uppercase">
          Curator&apos;s Insights
        </h3>
        
        <div className="space-y-[14px]">
          <div className="bg-white p-[18px] rounded-[18px] border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400" />
            <p className="text-[14px] font-bold text-gray-800 mb-2 break-keep leading-snug">
              &quot;데이터를 교차 검증하여 정확도를 높입니다&quot;
            </p>
            <p className="text-[12px] font-medium text-gray-500 break-keep">
              공식 보도자료와 실시간 뉴스를 대조합니다.
            </p>
          </div>
          
          <div className="bg-white p-[18px] rounded-[18px] border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400" />
            <p className="text-[14px] font-bold text-gray-800 mb-2 break-keep leading-snug">
              &quot;최신 뉴스와 소셜 미디어를 분석합니다&quot;
            </p>
            <p className="text-[12px] font-medium text-gray-500 break-keep">
              확산 경로를 추적하여 맥락을 파악합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 하단 Disclaimer */}
      <div className="mt-auto text-center pt-8 pb-2">
        <p className="text-[12px] text-gray-400 font-medium tracking-tight">
          분석이 길어지면 알림을 보내드립니다
        </p>
      </div>

    </div>
  );
}

export default function LoadingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoadingContent />
    </Suspense>
  );
}
