import { createHash } from "node:crypto";

export type ReviewRelevanceTier = "primary" | "reference" | "discard";
export type TopicScope = "domestic" | "foreign" | "multi_country" | "unknown";
export type RetrievalBucket = "familiar" | "verification" | "fallback";

export interface DomainRegistryEntry {
  id: string;
  domain: string;
  countryCode: string;
  languageCode: string | null;
  sourceKind: string;
  usageRole: string;
  priority: number;
  isActive: boolean;
}

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
  sourceCountryCode: string | null;
  retrievalBucket: RetrievalBucket;
  domainRegistryId: string | null;
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
      sourceCountryCode: existing.sourceCountryCode ?? candidate.sourceCountryCode,
      domainRegistryId: existing.domainRegistryId ?? candidate.domainRegistryId,
      retrievalBucket: pickPreferredBucket(existing.retrievalBucket, candidate.retrievalBucket),
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

export function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const mappedCodes: Record<string, string> = {
    kr: "KR",
    korea: "KR",
    "south korea": "KR",
    "republic of korea": "KR",
    한국: "KR",
    대한민국: "KR",
    us: "US",
    usa: "US",
    "united states": "US",
    america: "US",
    미국: "US",
    jp: "JP",
    japan: "JP",
    일본: "JP",
    cn: "CN",
    china: "CN",
    중국: "CN",
    gb: "GB",
    uk: "GB",
    "united kingdom": "GB",
    영국: "GB",
    global: "GLOBAL",
    international: "GLOBAL",
  };

  if (mappedCodes[normalized]) {
    return mappedCodes[normalized];
  }

  if (/^[a-z]{2}$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  return null;
}

export function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function matchesDomainPattern(
  hostname: string | null,
  pattern: string | null | undefined,
): boolean {
  if (!hostname || !pattern) {
    return false;
  }

  const normalizedPattern = pattern.trim().toLowerCase().replace(/^www\./, "");

  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  return hostname === normalizedPattern;
}

export function inferCountryCodeFromUrl(url: string): string | null {
  const hostname = extractHostname(url);

  if (!hostname) {
    return null;
  }

  if (hostname.endsWith(".kr")) {
    return "KR";
  }

  if (hostname.endsWith(".jp")) {
    return "JP";
  }

  if (hostname.endsWith(".cn")) {
    return "CN";
  }

  if (hostname.endsWith(".uk")) {
    return "GB";
  }

  if (hostname.endsWith(".gov") || hostname.endsWith(".mil")) {
    return "US";
  }

  return null;
}

export function matchDomainRegistryEntry(
  url: string,
  registry: DomainRegistryEntry[],
): DomainRegistryEntry | null {
  const hostname = extractHostname(url);

  if (!hostname) {
    return null;
  }

  const matched = registry
    .filter((entry) => entry.isActive && matchesDomainPattern(hostname, entry.domain))
    .sort((left, right) => {
      if (left.countryCode === "GLOBAL" && right.countryCode !== "GLOBAL") {
        return 1;
      }

      if (left.countryCode !== "GLOBAL" && right.countryCode === "GLOBAL") {
        return -1;
      }

      return left.priority - right.priority;
    });

  return matched[0] ?? null;
}

export function selectExtractionCandidates(
  candidates: SearchCandidate[],
  primaryLimit: number,
  referencePromotionLimit: number,
): SearchCandidate[] {
  const primary = candidates.filter((candidate) => candidate.relevanceTier === "primary");
  const reference = candidates.filter((candidate) => candidate.relevanceTier === "reference");
  const selected = [
    ...primary.slice(0, primaryLimit),
    ...reference.slice(
      0,
      Math.min(Math.max(primaryLimit - primary.length, 0), referencePromotionLimit),
    ),
  ];

  if (
    selected.some((candidate) => candidate.retrievalBucket === "verification")
  ) {
    return selected;
  }

  const verificationCandidate = [...primary, ...reference].find(
    (candidate) => candidate.retrievalBucket === "verification",
  );

  if (!verificationCandidate) {
    return selected;
  }

  const replaced = selected.filter(
    (candidate) => candidate.canonicalUrl !== verificationCandidate.canonicalUrl,
  );

  return [verificationCandidate, ...replaced].slice(0, primaryLimit + referencePromotionLimit);
}

export function hasVerificationSource(candidates: SearchCandidate[]): boolean {
  return candidates.some(
    (candidate) =>
      candidate.relevanceTier !== "discard" &&
      candidate.retrievalBucket === "verification",
  );
}

export function countRelevantSources(candidates: SearchCandidate[]): number {
  return candidates.filter((candidate) => candidate.relevanceTier !== "discard").length;
}

function pickPreferredBucket(
  left: RetrievalBucket,
  right: RetrievalBucket,
): RetrievalBucket {
  const precedence: Record<RetrievalBucket, number> = {
    verification: 3,
    familiar: 2,
    fallback: 1,
  };

  return precedence[left] >= precedence[right] ? left : right;
}
