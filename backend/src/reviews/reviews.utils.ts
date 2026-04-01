import { createHash } from "node:crypto";

export type ReviewRelevanceTier = "primary" | "reference" | "discard";

export interface QueryArtifact {
  id: string;
  text: string;
  rank: number;
}

export interface SearchCandidate {
  id: string;
  sourceType: string;
  publisherName: string | null;
  publishedAt: string | null;
  canonicalUrl: string;
  originalUrl: string;
  rawTitle: string;
  rawSnippet: string | null;
  normalizedHash: string;
  originQueryIds: string[];
  relevanceTier?: ReviewRelevanceTier;
  relevanceReason?: string | null;
  contentText?: string | null;
}

export function normalizeClaimText(rawClaim: string): string {
  return rawClaim.replace(/\s+/g, " ").replace(/[!?]{2,}/g, "?").trim();
}

export function buildCanonicalUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.search = "";

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}

export function buildNormalizedHash(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function deduplicateCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const deduped = new Map<string, SearchCandidate>();

  for (const candidate of candidates) {
    const key = candidate.canonicalUrl;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, {
        ...candidate,
        originQueryIds: [...candidate.originQueryIds],
      });
      continue;
    }

    const mergedQueryIds = new Set([...existing.originQueryIds, ...candidate.originQueryIds]);
    deduped.set(key, {
      ...existing,
      originQueryIds: [...mergedQueryIds],
      rawSnippet: existing.rawSnippet ?? candidate.rawSnippet,
      publisherName: existing.publisherName ?? candidate.publisherName,
      publishedAt: existing.publishedAt ?? candidate.publishedAt,
    });
  }

  return [...deduped.values()];
}

export function classifySourceType(url: string, title: string): string {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (
    lowerUrl.includes(".gov") ||
    lowerUrl.includes(".go.kr") ||
    lowerUrl.includes("press") ||
    lowerTitle.includes("보도자료") ||
    lowerTitle.includes("official")
  ) {
    return "official";
  }

  if (lowerTitle.includes("분석") || lowerTitle.includes("해설")) {
    return "analysis";
  }

  return "news";
}

export function buildMockCoreClaim(normalizedClaim: string): string {
  return normalizedClaim
    .replace(/^(나|저)(는|도)?\s*/u, "")
    .replace(/^(어제|오늘|방금)\s*/u, "")
    .replace(/뉴스에서\s*봤는데\s*/u, "")
    .replace(/사실(인가요|이에요|임|인지)\??$/u, "")
    .trim();
}

export function buildMockQueries(coreClaim: string, languageCode: string): QueryArtifact[] {
  const fallbackClaim = coreClaim || "검토 대상 주장";

  if (languageCode === "ko") {
    return [
      { id: "q1", text: fallbackClaim, rank: 1 },
      { id: "q2", text: `${fallbackClaim} 공식 발표`, rank: 2 },
      { id: "q3", text: `${fallbackClaim} 정정 해명`, rank: 3 },
    ];
  }

  return [
    { id: "q1", text: fallbackClaim, rank: 1 },
    { id: "q2", text: `${fallbackClaim} official statement`, rank: 2 },
    { id: "q3", text: `${fallbackClaim} correction response`, rank: 3 },
  ];
}

export function selectExtractionCandidates(
  candidates: SearchCandidate[],
  primaryLimit: number,
  referencePromotionLimit: number,
): SearchCandidate[] {
  const primary = candidates.filter((candidate) => candidate.relevanceTier === "primary");
  const reference = candidates.filter((candidate) => candidate.relevanceTier === "reference");

  if (primary.length >= primaryLimit) {
    return primary.slice(0, primaryLimit);
  }

  const remainingSlots = primaryLimit - primary.length;

  return [
    ...primary,
    ...reference.slice(0, Math.min(remainingSlots, referencePromotionLimit)),
  ];
}
