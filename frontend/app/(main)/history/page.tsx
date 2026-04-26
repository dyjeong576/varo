"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import { refreshNotifications } from "@/lib/notifications/store";
import { ReviewHistoryList } from "@/components/reviews/ReviewHistoryList";
import { ReviewPreviewSummary } from "@/lib/reviews/types";
import { getMergedReviewSummaries } from "@/lib/reviews/history";
import {
  removeReviewTask,
  removeReviewTaskByReviewId,
  subscribeReviewTasks,
} from "@/lib/reviews/task-store";

export default function HistoryPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewPreviewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getMergedReviewSummaries(api.reviews.getRecent)
      .then((result) => {
        if (active) {
          setReviews(result);
          setErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof ApiClientError
              ? error.message
              : "히스토리를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeReviewTasks(() => {
      void getMergedReviewSummaries(api.reviews.getRecent)
        .then((result) => {
          if (active) {
            setReviews(result);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleDeleteReview = async (review: ReviewPreviewSummary) => {
    const isPendingReview = review.reviewId.startsWith("pending:");
    const confirmMessage = isPendingReview
      ? "이 임시 review 기록을 삭제하시겠습니까?"
      : "이 review를 삭제하시겠습니까?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingReviewId(review.reviewId);

    try {
      if (isPendingReview) {
        removeReviewTask(review.reviewId);
      } else {
        await api.reviews.delete(review.reviewId);
        removeReviewTaskByReviewId(review.reviewId);
        void refreshNotifications().catch(() => undefined);
      }

      setReviews((currentReviews) =>
        currentReviews.filter((item) => item.reviewId !== review.reviewId),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "review를 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingReviewId(null);
    }
  };

  return (
    <div className="min-h-full bg-[#faf8ff] px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-[#424656] transition-colors hover:bg-[#e6e7f4]"
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#191b24]">
              History
            </h1>
            <p className="mt-1 text-sm text-[#6b7280]">
              최근 검토한 review preview를 다시 확인할 수 있습니다.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-[#ffd7d7] bg-[#fff6f6] px-4 py-3 text-sm text-[#b42318]">
            {errorMessage}
          </div>
        ) : null}

        <ReviewHistoryList
          reviews={reviews}
          isLoading={isLoading}
          emptyMessage="아직 생성된 review 기록이 없습니다."
          onDelete={handleDeleteReview}
          deletingReviewId={deletingReviewId}
        />
      </div>
    </div>
  );
}
