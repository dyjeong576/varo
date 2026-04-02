import { ReviewPreviewSummary } from "@/lib/reviews/types";
import { getReviewTaskSummaries } from "@/lib/reviews/task-store";

export function mergeReviewSummaries(
  serverReviews: ReviewPreviewSummary[],
  taskReviews: ReviewPreviewSummary[],
): ReviewPreviewSummary[] {
  const merged = new Map<string, ReviewPreviewSummary>();

  taskReviews.forEach((taskReview) => {
    merged.set(taskReview.reviewId, taskReview);
  });

  serverReviews.forEach((serverReview) => {
    merged.set(serverReview.reviewId, serverReview);
  });

  return Array.from(merged.values()).sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export async function getMergedReviewSummaries(
  fetchServerReviews: () => Promise<ReviewPreviewSummary[]>,
): Promise<ReviewPreviewSummary[]> {
  const serverReviews = await fetchServerReviews();

  return mergeReviewSummaries(serverReviews, getReviewTaskSummaries());
}
