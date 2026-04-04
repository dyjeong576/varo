"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import EvidenceGrid from "@/components/reviews/EvidenceGrid";
import EvidenceSnippetList from "@/components/reviews/EvidenceSnippetList";
import SourceCard from "@/components/reviews/SourceCard";
import UncertaintyCard from "@/components/reviews/UncertaintyCard";
import VerdictHero from "@/components/reviews/VerdictHero";
import { isReviewEntrySource } from "@/lib/reviews/navigation";
import { ReviewPreviewDetail, ReviewSourceCategory } from "@/lib/reviews/types";

const FILTERS: Array<{ label: string; value: "all" | ReviewSourceCategory }> = [
  { label: "전체", value: "all" },
  { label: "공식", value: "official" },
  { label: "언론", value: "press" },
  { label: "기타", value: "other" },
];

export default function ReviewResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewId = params.reviewId as string;
  const [review, setReview] = useState<ReviewPreviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ReviewSourceCategory>("all");
  const trackedEntryRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

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
  }, [reviewId]);

  useEffect(() => {
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
      .catch((error) => {
        console.error("Failed to record review reopen:", error);
      })
      .finally(() => {
        router.replace(`/reviews/${reviewId}`, { scroll: false });
      });
  }, [reviewId, router, searchParams]);

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

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,#f1f6ff_0%,#f8f9fc_32%,#f6f3fb_70%,#f5f1fb_100%)] px-4 py-5 sm:px-6 sm:py-6">
      <main className="mx-auto max-w-3xl space-y-8">
        <VerdictHero
          reviewId={review.reviewId}
          claim={review.claim}
          coreClaim={review.coreClaim}
          statusLabel={review.statusLabel}
          currentStageLabel={review.currentStageLabel}
          createdAtLabel={review.createdAtLabel}
          statusTone={review.statusTone}
        />

        <EvidenceGrid
          searchedSourceCount={review.searchedSourceCount}
          selectedSourceCount={review.selectedSourceCount}
          discardedSourceCount={review.discardedSourceCount}
          coreClaim={review.coreClaim}
          normalizedClaim={review.normalizedClaim}
          topicScopeLabel={review.topicScopeLabel}
          topicCountryCode={review.topicCountryCode}
          countryDetectionReason={review.countryDetectionReason}
          pendingMessage={review.pendingMessage}
          createdAtLabel={review.createdAtLabel}
          generatedQueries={review.generatedQueries}
        />

        <EvidenceSnippetList evidenceSnippets={review.evidenceSnippets} />

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

        <UncertaintyCard
          pendingMessage={review.pendingMessage}
          insufficiencyReason={review.insufficiencyReason}
        />
      </main>
    </div>
  );
}
