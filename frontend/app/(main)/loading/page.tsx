"use client";

import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Loader2, CheckCircle2, RefreshCw, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getActiveAnswerTask,
  getAnswerTask,
  startAnswerTask,
  subscribeAnswerTasks,
} from "@/lib/answers/task-store";

const STAGES = [
  "준비 중",
  "데이터 서버 연결 완료",
  "기사 수집 중",
  "소셜 정리 중",
  "커뮤니티 반응 분석 대기",
  "시각화 생성 중",
  "신뢰 지수 산출 대기",
];

function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft") ?? "";
  const [currentStage, setCurrentStage] = useState(0);
  const task = useSyncExternalStore(
    subscribeAnswerTasks,
    () => (draftId ? getAnswerTask(draftId) : null),
    () => null,
  );

  const checkQuery = task?.check ?? "";
  const errorMessage = task?.errorMessage ?? null;
  const isSubmitting =
    task?.status === "pending" || task?.status === "submitting";
  const isCompleted = task?.status === "succeeded" && Boolean(task.answerId);
  const isProcessing = task?.status === "processing" && Boolean(task.answerId);
  const isOutOfScope = task?.previewStatus === "out_of_scope";

  const activeStageIndex = useMemo(() => {
    if (isCompleted) {
      return STAGES.length - 1;
    }

    if (task?.status === "failed") {
      return currentStage;
    }

    return currentStage;
  }, [currentStage, isCompleted, task?.status]);

  useEffect(() => {
    const resolvedDraftId = draftId || getActiveAnswerTask()?.draftId;

    if (!resolvedDraftId) {
      router.replace("/");
      return;
    }

    if (!draftId) {
      router.replace(`/loading?draft=${encodeURIComponent(resolvedDraftId)}`);
      return;
    }

    const loadTask = () => getAnswerTask(resolvedDraftId);
    const initialTask = loadTask();

    if (!initialTask) {
      router.replace("/");
      return;
    }

    if (!initialTask.answerId && initialTask.status !== "failed") {
      void startAnswerTask(resolvedDraftId).catch(() => undefined);
    }

    return undefined;
  }, [draftId, router]);

  useEffect(() => {
    if (isProcessing && task?.answerId) {
      router.replace(`/answers/${encodeURIComponent(task.answerId)}`);
    }
  }, [isProcessing, router, task?.answerId]);

  useEffect(() => {
    if (!isSubmitting || errorMessage) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentStage((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 1500);

    return () => clearInterval(timer);
  }, [errorMessage, isSubmitting]);

  const handleRetry = async () => {
    if (!draftId) {
      router.replace("/");
      return;
    }

    setCurrentStage(0);

    try {
      await startAnswerTask(draftId);
    } catch {
      return;
    }
  };

  if (!task) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full px-6 pt-8 pb-8 bg-[#F8FAFC] font-sans">
      <div className="mb-10 text-center mt-2">
        <h1 className="text-[22px] font-extrabold text-gray-900 mb-2">
          {isOutOfScope ? "지원 범위 확인 완료" : "팩트체크 분석 중"}
        </h1>
        <h2 className="text-[15px] font-bold text-primary break-keep">
          {checkQuery || "입력된 주장 분석 중..."}
        </h2>
        <p className="mt-4 text-[13px] text-gray-500">
          {isOutOfScope
            ? "현재 MVP는 한국 관련 check만 검토합니다."
            : "신뢰할 수 있는 정보를 위해 다각도로 검증 중입니다."}
        </p>
      </div>

      <div className="w-full max-w-sm mx-auto bg-white rounded-[20px] p-6 mb-8 shadow-sm border border-gray-100/60">
        <div className="space-y-[22px]">
          {STAGES.map((stage, index) => {
            const hasCompleted = index < activeStageIndex || isCompleted;
            const isCurrent = index === activeStageIndex && isSubmitting;

            return (
              <div key={index} className="flex items-center">
                {hasCompleted ? (
                  <CheckCircle2 className="w-[18px] h-[18px] text-green-500 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary" />
                ) : !isSubmitting && errorMessage ? (
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-red-200 bg-red-50 shrink-0" />
                ) : (
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-200 shrink-0" />
                )}

                <span
                  className={`ml-4 text-[14px] font-semibold tracking-tight ${
                    hasCompleted
                      ? "text-gray-900"
                      : isCurrent
                        ? "text-primary"
                        : !isSubmitting && errorMessage
                          ? "text-gray-400"
                          : "text-gray-300"
                  }`}
                >
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isCompleted && task.answerId ? (
        <div className={`w-full max-w-sm mx-auto mb-6 rounded-[18px] border px-5 py-4 ${
          isOutOfScope
            ? "border-slate-200 bg-white"
            : "border-blue-100 bg-blue-50"
        }`}>
          <p className={`text-sm font-semibold ${
            isOutOfScope ? "text-slate-700" : "text-blue-800"
          }`}>
            {isOutOfScope
              ? "한국 관련성이 확인되지 않아 판단 없이 기록되었습니다. 상세 화면에서 범위 확인 이유를 볼 수 있습니다."
              : "근거 수집이 완료되었습니다. 결과를 열어 source와 evidence를 확인할 수 있습니다."}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => router.push(`/answers/${task.answerId}`)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              {isOutOfScope ? "기록 보기" : "결과 보기"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              계속 둘러보기
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="w-full max-w-sm mx-auto mb-6 rounded-[18px] border border-red-100 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-700">{errorMessage}</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </button>
            <button
              onClick={() => router.replace("/")}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      ) : null}

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

      <div className="mt-auto text-center pt-8 pb-2">
        <p className="text-[12px] text-gray-400 font-medium tracking-tight">
          완료되면 알림과 히스토리에서 다시 결과를 열 수 있습니다
        </p>
      </div>
    </div>
  );
}

export default function LoadingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoadingContent />
    </Suspense>
  );
}
