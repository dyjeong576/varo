"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ReviewHistoryList } from "@/components/reviews/ReviewHistoryList";
import { ReviewPreviewSummary } from "@/lib/reviews/types";
import { getMergedReviewSummaries } from "@/lib/reviews/history";
import { subscribeReviewTasks } from "@/lib/reviews/task-store";

export default function HistoryPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewPreviewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getMergedReviewSummaries(api.reviews.getRecent)
      .then((result) => {
        if (active) {
          setReviews(result);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeReviewTasks(() => {
      void getMergedReviewSummaries(api.reviews.getRecent).then((result) => {
        if (active) {
          setReviews(result);
        }
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

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

        <ReviewHistoryList
          reviews={reviews}
          isLoading={isLoading}
          emptyMessage="아직 생성된 review 기록이 없습니다."
        />
      </div>
    </div>
  );
}
