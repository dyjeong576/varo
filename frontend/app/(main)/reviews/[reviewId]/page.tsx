"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import EvidenceGrid, {
  QueryContextDisclosure,
} from "@/components/reviews/EvidenceGrid";
import EvidenceSnippetList from "@/components/reviews/EvidenceSnippetList";
import SourceCard from "@/components/reviews/SourceCard";
import UncertaintyCard from "@/components/reviews/UncertaintyCard";
import VerdictHero from "@/components/reviews/VerdictHero";
import AnalysisSummary from "@/components/reviews/AnalysisSummary";
import { isReviewEntrySource } from "@/lib/reviews/navigation";
import {
  getReviewTask,
  patchReviewTaskByReviewId,
} from "@/lib/reviews/task-store";
import { ReviewPreviewDetail, ReviewSourceCategory } from "@/lib/reviews/types";

const FILTERS: Array<{ label: string; value: "all" | ReviewSourceCategory }> = [
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

export default function ReviewResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewId = params.reviewId as string;
  const isPendingReviewRoute = reviewId.startsWith("pending:");
  const pendingReviewTask = isPendingReviewRoute ? getReviewTask(reviewId) : null;
  const pendingRouteErrorMessage =
    isPendingReviewRoute &&
    pendingReviewTask?.status !== "pending" &&
    pendingReviewTask?.status !== "submitting" &&
    !pendingReviewTask?.reviewId
      ? pendingReviewTask?.errorMessage ??
        "아직 서버에 저장되지 않은 임시 review라 상세 화면을 열 수 없습니다."
      : null;
  const [review, setReview] = useState<ReviewPreviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ReviewSourceCategory>("all");
  const trackedEntryRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (isPendingReviewRoute) {
      if (pendingReviewTask?.reviewId && pendingReviewTask.reviewId !== reviewId) {
        router.replace(`/reviews/${encodeURIComponent(pendingReviewTask.reviewId)}`);
        return () => {
          isMounted = false;
        };
      }

      if (
        pendingReviewTask?.status === "pending" ||
        pendingReviewTask?.status === "submitting"
      ) {
        router.replace(`/loading?draft=${encodeURIComponent(reviewId)}`);
        return () => {
          isMounted = false;
        };
      }

      return () => {
        isMounted = false;
      };
    }

    api.reviews
      .getDetail(reviewId)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setReview(response);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : "리뷰 preview를 불러오지 못했습니다.",
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
  }, [isPendingReviewRoute, pendingReviewTask, reviewId, router]);

  useEffect(() => {
    if (isPendingReviewRoute || !review) {
      return;
    }

    const entry = searchParams.get("entry");

    if (!isReviewEntrySource(entry)) {
      trackedEntryRef.current = null;
      return;
    }

    const trackingKey = `${reviewId}:${entry}`;
    if (trackedEntryRef.current === trackingKey) {
      return;
    }

    trackedEntryRef.current = trackingKey;

    api.reviews
      .recordReopen(reviewId, entry)
      .catch(() => undefined)
      .finally(() => {
        router.replace(`/reviews/${reviewId}`, { scroll: false });
      });
  }, [isPendingReviewRoute, review, reviewId, router, searchParams]);

  useEffect(() => {
    if (isPendingReviewRoute || review?.status !== "searching") {
      return;
    }

    const timer = window.setInterval(() => {
      api.reviews
        .getDetail(reviewId)
        .then((response) => {
          setReview(response);

          if (response.status !== "searching") {
            patchReviewTaskByReviewId(reviewId, {
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
  }, [isPendingReviewRoute, review?.status, reviewId]);

  if (isPendingReviewRoute) {
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

  if (!review || errorMessage) {
    return (
      <div className="px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage ?? "리뷰 preview를 찾을 수 없습니다."}
        </div>
      </div>
    );
  }

  const filteredSources =
    filter === "all"
      ? review.sources
      : filter === "other"
        ? review.sources.filter(
            (source) =>
              source.sourceCategory !== "official" &&
              source.sourceCategory !== "press",
          )
        : review.sources.filter((source) => source.sourceCategory === filter);
  const hasReviewResult =
    !review.isOutOfScope &&
    review.verdictLabel !== null &&
    review.confidenceScore !== null &&
    review.analysisSummary !== null &&
    review.uncertaintySummary !== null &&
    review.resultMode !== null;
  const isSignalClassificationPending =
    !review.isOutOfScope && review.status === "searching";

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,#f1f6ff_0%,#f8f9fc_32%,#f6f3fb_70%,#f5f1fb_100%)] px-4 py-5 sm:px-6 sm:py-6">
      <main className="mx-auto max-w-3xl space-y-8">
        {hasReviewResult ? (
          <VerdictHero
            claim={review.claim}
            verdictLabel={review.verdictLabel!}
            confidenceScore={review.confidenceScore!}
            createdAtLabel={review.createdAtLabel}
            currentStageLabel={review.currentStageLabel}
            pendingMessage={review.pendingMessage}
          />
        ) : isSignalClassificationPending ? (
          <section className="space-y-4">
            <div className="rounded-xl border border-[#dfe4f0] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#0050cb]">
                  출처 수집 완료
                </span>
                <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-[#0050cb]">
                  {review.currentStageLabel}
                </span>
              </div>

              <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.04em] text-[#191b24] sm:text-[2.2rem]">
                {review.claim}
              </h1>

              <div className="mt-6 rounded-xl bg-[#f8fafc] px-4 py-4 text-sm leading-6 text-[#475569]">
                뉴스 검색 결과를 먼저 표시합니다. verdict와 근거 신호는 수집된
                출처만 기준으로 분류되는 중입니다.
              </div>
            </div>

            <p className="text-sm leading-6 text-[#6b7280]">
              {review.pendingMessage}
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
                  {review.currentStageLabel}
                </span>
              </div>

              <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.04em] text-[#191b24] sm:text-[2.2rem]">
                {review.claim}
              </h1>

              <div className="mt-6 rounded-xl bg-[#f8fafc] px-4 py-4 text-sm leading-6 text-[#475569]">
                현재 MVP는 한국 관련 claim만 검토합니다. 이 claim은 판단 없이
                지원 범위 밖으로 기록되었습니다.
              </div>
            </div>

            <div className="rounded-xl border border-[#dfe4f0] bg-white p-5 text-sm leading-6 text-[#475569]">
              <p className="font-bold text-[#191b24]">한국 관련성 판단 이유</p>
              <p className="mt-2">{review.koreaRelevanceReason}</p>
            </div>
          </section>
        )}

        {hasReviewResult ? (
          <AnalysisSummary
            interpretation={review.analysisSummary!}
            mode={review.resultMode!}
            officialSourceCount={review.sourceBreakdown.official}
            sourceCount={review.sources.length}
            evidenceSnippetCount={review.evidenceSnippets.length}
          />
        ) : null}

        {isSignalClassificationPending ? (
          <SignalClassificationSkeleton sourceCount={review.sources.length} />
        ) : (
          <EvidenceGrid
            searchedSourceCount={review.searchedSourceCount}
            selectedSourceCount={review.selectedSourceCount}
            agreementCount={review.agreementCount}
            conflictCount={review.conflictCount}
            contextCount={review.contextCount}
            consensusLabel={review.consensusLabel}
            sourceBreakdown={review.sourceBreakdown}
          />
        )}

        {review.evidenceSnippets.length > 0 ? (
          <EvidenceSnippetList evidenceSnippets={review.evidenceSnippets} />
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
                <SourceCard key={source.id} source={source} />
              ))
            )}
          </div>
        </section>

        <QueryContextDisclosure
          searchedSourceCount={review.searchedSourceCount}
          selectedSourceCount={review.selectedSourceCount}
          discardedSourceCount={review.discardedSourceCount}
          coreClaim={review.coreClaim}
          normalizedClaim={review.normalizedClaim}
          topicCountryCode={review.topicCountryCode}
          countryDetectionReason={review.countryDetectionReason}
          generatedQueries={review.generatedQueries}
        />

        {hasReviewResult ? (
          <UncertaintyCard
            pendingMessage={review.pendingMessage}
            insufficiencyReason={review.insufficiencyReason}
            uncertaintySummary={review.uncertaintySummary!}
            uncertaintyItems={review.uncertaintyItems}
          />
        ) : null}
      </main>
    </div>
  );
}
