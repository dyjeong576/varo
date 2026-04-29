"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import EvidenceGrid, {
  QueryContextDisclosure,
} from "@/components/answers/EvidenceGrid";
import EvidenceSnippetList from "@/components/answers/EvidenceSnippetList";
import SourceCard from "@/components/answers/SourceCard";
import UncertaintyCard from "@/components/answers/UncertaintyCard";
import VerdictHero from "@/components/answers/VerdictHero";
import AnalysisSummary from "@/components/answers/AnalysisSummary";
import { isAnswerEntrySource } from "@/lib/answers/navigation";
import {
  getAnswerTask,
  patchAnswerTaskByAnswerId,
} from "@/lib/answers/task-store";
import { AnswerPreviewDetail, AnswerSourceCategory } from "@/lib/answers/types";

const FILTERS: Array<{ label: string; value: "all" | AnswerSourceCategory }> = [
  { label: "전체", value: "all" },
  { label: "공식", value: "official" },
  { label: "언론", value: "press" },
  { label: "기타", value: "other" },
];

function SignalClassificationSkeleton({
  sourceCount,
}: {
  sourceCount: number;
}) {
  return (
    <section className="space-y-4" aria-label="근거 신호 분류 진행 중">
      <div className="rounded-xl border border-[#dfe4f0] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0050cb]">
              Signal Classification
            </p>
            <p className="mt-1 text-sm font-semibold text-[#556070]">
              {sourceCount}개 출처의 근거 신호를 분류하고 있습니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-[#0050cb]">
            <span className="h-2 w-2 rounded-full bg-[#0050cb]" />
            진행 중
          </span>
        </div>

        <div className="space-y-3">
          <div className="skeleton-shimmer h-5 w-2/3 rounded-full" />
          <div className="skeleton-shimmer h-5 w-full rounded-full" />
          <div className="skeleton-shimmer h-5 w-4/5 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#dfe4f0] bg-white p-5">
          <div className="skeleton-shimmer h-4 w-20 rounded-full" />
          <div className="mt-6 flex h-16 items-end gap-2">
            <div className="skeleton-shimmer h-10 flex-1 rounded-t-sm" />
            <div className="skeleton-shimmer h-16 flex-1 rounded-t-sm" />
            <div className="skeleton-shimmer h-8 flex-1 rounded-t-sm" />
          </div>
        </div>

        <div className="rounded-xl border border-[#dfe4f0] bg-white p-5">
          <div className="skeleton-shimmer h-4 w-24 rounded-full" />
          <div className="mt-7 space-y-3">
            <div className="skeleton-shimmer mx-auto h-8 w-24 rounded-full" />
            <div className="skeleton-shimmer mx-auto h-3 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AnswerResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const answerId = params.answerId as string;
  const isPendingAnswerRoute = answerId.startsWith("pending:");
  const pendingAnswerTask = isPendingAnswerRoute ? getAnswerTask(answerId) : null;
  const pendingRouteErrorMessage =
    isPendingAnswerRoute &&
    pendingAnswerTask?.status !== "pending" &&
    pendingAnswerTask?.status !== "submitting" &&
    !pendingAnswerTask?.answerId
      ? pendingAnswerTask?.errorMessage ??
        "아직 서버에 저장되지 않은 임시 answer라 상세 화면을 열 수 없습니다."
      : null;
  const [answer, setAnswer] = useState<AnswerPreviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AnswerSourceCategory>("all");
  const trackedEntryRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (isPendingAnswerRoute) {
      if (pendingAnswerTask?.answerId && pendingAnswerTask.answerId !== answerId) {
        router.replace(`/answers/${encodeURIComponent(pendingAnswerTask.answerId)}`);
        return () => {
          isMounted = false;
        };
      }

      if (
        pendingAnswerTask?.status === "pending" ||
        pendingAnswerTask?.status === "submitting"
      ) {
        router.replace(`/loading?draft=${encodeURIComponent(answerId)}`);
        return () => {
          isMounted = false;
        };
      }

      return () => {
        isMounted = false;
      };
    }

    api.answers
      .getDetail(answerId)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setAnswer(response);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : "answer preview를 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isPendingAnswerRoute, pendingAnswerTask, answerId, router]);

  useEffect(() => {
    if (isPendingAnswerRoute || !answer) {
      return;
    }

    const entry = searchParams.get("entry");

    if (!isAnswerEntrySource(entry)) {
      trackedEntryRef.current = null;
      return;
    }

    const trackingKey = `${answerId}:${entry}`;
    if (trackedEntryRef.current === trackingKey) {
      return;
    }

    trackedEntryRef.current = trackingKey;

    api.answers
      .recordReopen(answerId, entry)
      .catch(() => undefined)
      .finally(() => {
        router.replace(`/answers/${answerId}`, { scroll: false });
      });
  }, [isPendingAnswerRoute, answer, answerId, router, searchParams]);

  useEffect(() => {
    if (isPendingAnswerRoute || answer?.status !== "searching") {
      return;
    }

    const timer = window.setInterval(() => {
      api.answers
        .getDetail(answerId)
        .then((response) => {
          setAnswer(response);

          if (response.status !== "searching") {
            patchAnswerTaskByAnswerId(answerId, {
              status: response.status === "failed" ? "failed" : "succeeded",
              previewStatus: response.status,
              currentStage: response.currentStage,
              selectedSourceCount: response.selectedSourceCount,
              completedAt: new Date().toISOString(),
            });
          }
        })
        .catch(() => undefined);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [isPendingAnswerRoute, answer?.status, answerId]);

  if (isPendingAnswerRoute) {
    if (pendingRouteErrorMessage) {
      return (
        <div className="px-6 py-10">
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
            {pendingRouteErrorMessage}
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[calc(100dvh-7rem)] items-center justify-center px-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] items-center justify-center px-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!answer || errorMessage) {
    return (
      <div className="px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage ?? "answer preview를 찾을 수 없습니다."}
        </div>
      </div>
    );
  }

  const filteredSources =
    filter === "all"
      ? answer.sources
      : filter === "other"
        ? answer.sources.filter(
            (source) =>
              source.sourceCategory !== "official" &&
              source.sourceCategory !== "press",
          )
        : answer.sources.filter((source) => source.sourceCategory === filter);
  const hasAnswerResult =
    !answer.isOutOfScope &&
    answer.verdictLabel !== null &&
    answer.confidenceScore !== null &&
    answer.analysisSummary !== null &&
    answer.uncertaintySummary !== null &&
    answer.resultMode !== null;
  const isSignalClassificationPending =
    !answer.isOutOfScope && answer.status === "searching";

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,#f1f6ff_0%,#f8f9fc_32%,#f6f3fb_70%,#f5f1fb_100%)] px-4 py-5 sm:px-6 sm:py-6">
      <main className="mx-auto max-w-3xl space-y-8">
        {hasAnswerResult ? (
          <VerdictHero
            check={answer.check}
            verdictLabel={answer.verdictLabel!}
            confidenceScore={answer.confidenceScore!}
            createdAtLabel={answer.createdAtLabel}
            currentStageLabel={answer.currentStageLabel}
            pendingMessage={answer.pendingMessage}
          />
        ) : isSignalClassificationPending ? (
          <section className="space-y-4">
            <div className="rounded-xl border border-[#dfe4f0] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#0050cb]">
                  출처 수집 완료
                </span>
                <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-[#0050cb]">
                  {answer.currentStageLabel}
                </span>
              </div>

              <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.04em] text-[#191b24] sm:text-[2.2rem]">
                {answer.check}
              </h1>

              <div className="mt-6 rounded-xl bg-[#f8fafc] px-4 py-4 text-sm leading-6 text-[#475569]">
                뉴스 검색 결과를 먼저 표시합니다. verdict와 근거 신호는 수집된
                출처만 기준으로 분류되는 중입니다.
              </div>
            </div>

            <p className="text-sm leading-6 text-[#6b7280]">
              {answer.pendingMessage}
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="rounded-xl border border-[#dfe4f0] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#64748b]">
                  지원 범위 확인
                </span>
                <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-bold text-[#475569]">
                  {answer.currentStageLabel}
                </span>
              </div>

              <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.04em] text-[#191b24] sm:text-[2.2rem]">
                {answer.check}
              </h1>

              <div className="mt-6 rounded-xl bg-[#f8fafc] px-4 py-4 text-sm leading-6 text-[#475569]">
                현재 지원 범위 밖 check으로 기록되었습니다. 이 기록은 판단 없이
                범위 확인 결과만 표시합니다.
              </div>
            </div>
          </section>
        )}

        {hasAnswerResult ? (
          <AnalysisSummary
            interpretation={answer.analysisSummary!}
            mode={answer.resultMode!}
            officialSourceCount={answer.sourceBreakdown.official}
            sourceCount={answer.sources.length}
            evidenceSnippetCount={answer.evidenceSnippets.length}
          />
        ) : null}

        {isSignalClassificationPending ? (
          <SignalClassificationSkeleton sourceCount={answer.sources.length} />
        ) : (
          <EvidenceGrid
            searchedSourceCount={answer.searchedSourceCount}
            selectedSourceCount={answer.selectedSourceCount}
            agreementCount={answer.agreementCount}
            conflictCount={answer.conflictCount}
            contextCount={answer.contextCount}
            consensusLabel={answer.consensusLabel}
            sourceBreakdown={answer.sourceBreakdown}
          />
        )}

        {answer.evidenceSnippets.length > 0 ? (
          <EvidenceSnippetList evidenceSnippets={answer.evidenceSnippets} />
        ) : null}

        <section className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-xl font-black tracking-[-0.03em] text-[#191b24]">
              <span className="material-symbols-outlined text-[#0050cb]">list_alt</span>
              Cross-Reference List
              <span className="text-base font-bold text-[#8a94a6]">
                {filteredSources.length}
              </span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    filter === option.value
                      ? "bg-[#eef5ff] text-[#0050cb] ring-1 ring-[#c7dbff]"
                      : "bg-white text-[#6b7280] ring-1 ring-[#e6ebf3]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredSources.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#cbd5e1] bg-white px-5 py-8 text-center text-sm text-[#6b7280] shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                해당 유형의 source가 없습니다.
              </div>
            ) : (
              filteredSources.map((source) => (
                <SourceCard key={source.id} source={source} isClassifying={isSignalClassificationPending} />
              ))
            )}
          </div>
        </section>

        <QueryContextDisclosure
          searchedSourceCount={answer.searchedSourceCount}
          selectedSourceCount={answer.selectedSourceCount}
          discardedSourceCount={answer.discardedSourceCount}
          coreCheck={answer.coreCheck}
          normalizedCheck={answer.normalizedCheck}
          generatedQueries={answer.generatedQueries}
        />

        {hasAnswerResult ? (
          <UncertaintyCard
            pendingMessage={answer.pendingMessage}
            insufficiencyReason={answer.insufficiencyReason}
            uncertaintySummary={answer.uncertaintySummary!}
            uncertaintyItems={answer.uncertaintyItems}
          />
        ) : null}
      </main>
    </div>
  );
}
