"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import EvidenceGrid from "@/components/reviews/EvidenceGrid";
import EvidenceSnippetList from "@/components/reviews/EvidenceSnippetList";
import SourceCard from "@/components/reviews/SourceCard";
import UncertaintyCard from "@/components/reviews/UncertaintyCard";
import VerdictHero from "@/components/reviews/VerdictHero";
import { ReviewPreviewDetail, ReviewSourceCategory } from "@/lib/reviews/types";

const FILTERS: Array<{ label: string; value: "all" | ReviewSourceCategory }> = [
  { label: "전체", value: "all" },
  { label: "공식", value: "official" },
  { label: "언론", value: "press" },
  { label: "기타", value: "other" },
];

export default function ReviewResultPage() {
  const params = useParams();
  const reviewId = params.reviewId as string;
  const [review, setReview] = useState<ReviewPreviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ReviewSourceCategory>("all");

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
    <div className="bg-[#faf8ff] min-h-full px-6 py-6">
      <main className="mx-auto max-w-2xl space-y-8">
        <VerdictHero
          claim={review.claim}
          statusLabel={review.statusLabel}
          currentStageLabel={review.currentStageLabel}
          createdAtLabel={review.createdAtLabel}
          pendingMessage={review.pendingMessage}
          statusTone={review.statusTone}
        />

        <EvidenceGrid
          searchedSourceCount={review.searchedSourceCount}
          selectedSourceCount={review.selectedSourceCount}
          discardedSourceCount={review.discardedSourceCount}
          coreClaim={review.coreClaim}
          topicScopeLabel={review.topicScopeLabel}
          topicCountryCode={review.topicCountryCode}
          generatedQueries={review.generatedQueries}
        />

        <section className="rounded-xl border border-[#c2c6d8]/15 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0050cb]">
            Query Context
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#191b24]">
            정규화 claim: {review.normalizedClaim}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#424656]">
            {review.countryDetectionReason}
          </p>
        </section>

        <EvidenceSnippetList evidenceSnippets={review.evidenceSnippets} />

        <section className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-[#191b24] tracking-tight">
              수집된 source ({filteredSources.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    filter === option.value
                      ? "bg-[#0050cb] text-white"
                      : "bg-[#e6e7f4] text-[#424656]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredSources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#c2c6d8] bg-white px-5 py-8 text-center text-sm text-[#6b7280]">
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
