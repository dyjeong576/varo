import { ApiClientError } from "@/lib/api/http";
import { ReviewPreviewSummary } from "@/lib/reviews/types";
import { getReviewTaskSummaries } from "@/lib/reviews/task-store";

const DUPLICATE_CLAIM_WINDOW_MS = 10 * 60 * 1000;

function normalizeComparableClaim(claim: string): string {
  return claim.trim().replace(/\s+/g, " ").toLowerCase();
}

function getCreatedAtTime(review: ReviewPreviewSummary): number {
  const time = new Date(review.createdAt).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function isLocalPendingSummary(review: ReviewPreviewSummary): boolean {
  return review.reviewId.startsWith("pending:");
}

function shouldTreatAsDuplicateClaim(
  left: ReviewPreviewSummary,
  right: ReviewPreviewSummary,
): boolean {
  const leftClaim = normalizeComparableClaim(left.claim);
  const rightClaim = normalizeComparableClaim(right.claim);

  if (!leftClaim || leftClaim !== rightClaim) {
    return false;
  }

  return (
    Math.abs(getCreatedAtTime(left) - getCreatedAtTime(right)) <=
    DUPLICATE_CLAIM_WINDOW_MS
  );
}

function chooseRepresentativeReview(
  current: ReviewPreviewSummary,
  candidate: ReviewPreviewSummary,
): ReviewPreviewSummary {
  const currentIsPending = isLocalPendingSummary(current);
  const candidateIsPending = isLocalPendingSummary(candidate);

  if (currentIsPending !== candidateIsPending) {
    return candidateIsPending ? current : candidate;
  }

  if (current.selectedSourceCount !== candidate.selectedSourceCount) {
    return current.selectedSourceCount > candidate.selectedSourceCount
      ? current
      : candidate;
  }

  return getCreatedAtTime(current) >= getCreatedAtTime(candidate)
    ? current
    : candidate;
}

function dedupeDuplicateClaimSubmissions(
  reviews: ReviewPreviewSummary[],
): ReviewPreviewSummary[] {
  const deduped: ReviewPreviewSummary[] = [];

  reviews.forEach((review) => {
    const duplicateIndex = deduped.findIndex((existing) =>
      shouldTreatAsDuplicateClaim(existing, review),
    );

    if (duplicateIndex === -1) {
      deduped.push(review);
      return;
    }

    deduped[duplicateIndex] = chooseRepresentativeReview(
      deduped[duplicateIndex],
      review,
    );
  });

  return deduped;
}

export function mergeReviewSummaries(
  serverReviews: ReviewPreviewSummary[],
  taskReviews: ReviewPreviewSummary[],
): ReviewPreviewSummary[] {
  const merged = new Map<string, ReviewPreviewSummary>();
  const getMergeKey = (review: ReviewPreviewSummary) =>
    review.clientRequestId ?? review.reviewId;

  taskReviews.forEach((taskReview) => {
    merged.set(getMergeKey(taskReview), taskReview);
  });

  serverReviews.forEach((serverReview) => {
    merged.set(getMergeKey(serverReview), serverReview);
  });

  const sortedReviews = Array.from(merged.values()).sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return dedupeDuplicateClaimSubmissions(sortedReviews).sort(
    (left, right) => getCreatedAtTime(right) - getCreatedAtTime(left),
  );
}

export async function getMergedReviewSummaries(
  fetchServerReviews: () => Promise<ReviewPreviewSummary[]>,
): Promise<ReviewPreviewSummary[]> {
  const taskReviews = getReviewTaskSummaries();

  try {
    const serverReviews = await fetchServerReviews();

    return mergeReviewSummaries(serverReviews, taskReviews);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }

      return mergeReviewSummaries([], taskReviews);
    }

    throw error;
  }
}
