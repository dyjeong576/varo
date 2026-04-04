export const REVIEW_ENTRY_SOURCES = [
  "popular",
  "history",
  "notification",
] as const;

export type ReviewEntrySource = (typeof REVIEW_ENTRY_SOURCES)[number];

export function isReviewEntrySource(value: string | null): value is ReviewEntrySource {
  return REVIEW_ENTRY_SOURCES.some((source) => source === value);
}

export function buildReviewEntryHref(
  reviewId: string,
  source?: ReviewEntrySource,
): string {
  const basePath = `/reviews/${encodeURIComponent(reviewId)}`;

  if (!source) {
    return basePath;
  }

  return `${basePath}?entry=${encodeURIComponent(source)}`;
}
