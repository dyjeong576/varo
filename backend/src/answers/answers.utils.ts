import { createHash } from "node:crypto";
import {
  DomainRegistryEntry,
  QueryArtifact,
  RetrievalBucket,
  SearchCandidate,
  SourcePoliticalLean,
} from "./answers.types";

const KOREAN_TRUSTED_NEWS_DOMAINS: Array<{
  id: string;
  domain: string;
  publisherName: string;
  politicalLean: SourcePoliticalLean;
  priority: number;
}> = [
  {
    id: "kr-progressive-hani",
    domain: "*.hani.co.kr",
    publisherName: "한겨레",
    politicalLean: "progressive",
    priority: 10,
  },
  {
    id: "kr-progressive-khan",
    domain: "*.khan.co.kr",
    publisherName: "경향신문",
    politicalLean: "progressive",
    priority: 11,
  },
  {
    id: "kr-progressive-ohmynews",
    domain: "*.ohmynews.com",
    publisherName: "오마이뉴스",
    politicalLean: "progressive",
    priority: 12,
  },
  {
    id: "kr-progressive-pressian",
    domain: "*.pressian.com",
    publisherName: "프레시안",
    politicalLean: "progressive",
    priority: 13,
  },
  {
    id: "kr-centrist-yna",
    domain: "*.yna.co.kr",
    publisherName: "연합뉴스",
    politicalLean: "centrist",
    priority: 20,
  },
  {
    id: "kr-centrist-hankookilbo",
    domain: "*.hankookilbo.com",
    publisherName: "한국일보",
    politicalLean: "centrist",
    priority: 21,
  },
  {
    id: "kr-centrist-kmib",
    domain: "*.kmib.co.kr",
    publisherName: "국민일보",
    politicalLean: "centrist",
    priority: 22,
  },
  {
    id: "kr-centrist-sbs",
    domain: "*.sbs.co.kr",
    publisherName: "SBS",
    politicalLean: "centrist",
    priority: 23,
  },
  {
    id: "kr-centrist-jtbc",
    domain: "*.jtbc.co.kr",
    publisherName: "JTBC",
    politicalLean: "centrist",
    priority: 24,
  },
  {
    id: "kr-conservative-chosun",
    domain: "*.chosun.com",
    publisherName: "조선일보",
    politicalLean: "conservative",
    priority: 30,
  },
  {
    id: "kr-conservative-joongang",
    domain: "*.joongang.co.kr",
    publisherName: "중앙일보",
    politicalLean: "conservative",
    priority: 31,
  },
  {
    id: "kr-conservative-donga",
    domain: "*.donga.com",
    publisherName: "동아일보",
    politicalLean: "conservative",
    priority: 32,
  },
  {
    id: "kr-conservative-munhwa",
    domain: "*.munhwa.com",
    publisherName: "문화일보",
    politicalLean: "conservative",
    priority: 33,
  },
  {
    id: "kr-conservative-tvchosun",
    domain: "*.tvchosun.com",
    publisherName: "TV조선",
    politicalLean: "conservative",
    priority: 34,
  },
  {
    id: "kr-business-mk",
    domain: "*.mk.co.kr",
    publisherName: "매일경제",
    politicalLean: "business",
    priority: 40,
  },
  {
    id: "kr-business-hankyung",
    domain: "*.hankyung.com",
    publisherName: "한국경제",
    politicalLean: "business",
    priority: 41,
  },
  {
    id: "kr-business-sedaily",
    domain: "*.sedaily.com",
    publisherName: "서울경제",
    politicalLean: "business",
    priority: 42,
  },
  {
    id: "kr-business-mt",
    domain: "*.mt.co.kr",
    publisherName: "머니투데이",
    politicalLean: "business",
    priority: 43,
  },
  {
    id: "kr-business-edaily",
    domain: "*.edaily.co.kr",
    publisherName: "이데일리",
    politicalLean: "business",
    priority: 44,
  },
];

const SOCIAL_SOURCE_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "threads.net",
  "facebook.com",
  "x.com",
  "twitter.com",
];

export function getKoreanSearchDomainRegistry(): DomainRegistryEntry[] {
  return KOREAN_TRUSTED_NEWS_DOMAINS.map((entry) => ({
    id: entry.id,
    domain: entry.domain,
    sourceKind: "news_media",
    usageRole: "familiar_news",
    priority: entry.priority,
    isActive: true,
    publisherName: entry.publisherName,
    politicalLean: entry.politicalLean,
  }));
}

export function normalizeCheckText(rawCheck: string): string {
  return rawCheck.replace(/\s+/g, " ").replace(/[!?]{2,}/g, "?").trim();
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
        originQueryPurposes: [...(candidate.originQueryPurposes ?? [])],
      });
      continue;
    }

    const mergedQueryIds = new Set([...existing.originQueryIds, ...candidate.originQueryIds]);
    const mergedQueryPurposes = new Set([
      ...(existing.originQueryPurposes ?? []),
      ...(candidate.originQueryPurposes ?? []),
    ]);
    deduped.set(key, {
      ...existing,
      originQueryIds: [...mergedQueryIds],
      originQueryPurposes: [...mergedQueryPurposes],
      rawSnippet: existing.rawSnippet ?? candidate.rawSnippet,
      publisherName: existing.publisherName ?? candidate.publisherName,
      publishedAt: existing.publishedAt ?? candidate.publishedAt,
      domainRegistryId: existing.domainRegistryId ?? candidate.domainRegistryId,
      sourcePoliticalLean: existing.sourcePoliticalLean ?? candidate.sourcePoliticalLean,
      retrievalBucket: pickPreferredBucket(existing.retrievalBucket, candidate.retrievalBucket),
    });
  }

  return [...deduped.values()];
}

export function classifySourceType(url: string, title: string): string {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const hostname = extractHostname(url);

  if (
    hostname &&
    SOCIAL_SOURCE_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  ) {
    return "social";
  }

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

export function buildMockCoreCheck(normalizedCheck: string): string {
  return normalizedCheck
    .replace(/^(나|저)(는|도)?\s*/u, "")
    .replace(/^(어제|오늘|방금)\s*/u, "")
    .replace(/뉴스에서\s*봤는데\s*/u, "")
    .replace(/사실(인가요|이에요|임|인지)\??$/u, "")
    .trim();
}

export function buildMockQueries(coreCheck: string): QueryArtifact[] {
  const fallbackCheck = coreCheck || "검토 대상 주장";

  return [
    { id: "q1", text: fallbackCheck, rank: 1 },
    { id: "q2", text: `${fallbackCheck} 공식 발표`, rank: 2 },
    { id: "q3", text: `${fallbackCheck} 정정 해명`, rank: 3 },
  ];
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
    .sort((left, right) => left.priority - right.priority);

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

export function selectDomainsForBucket(
  registry: DomainRegistryEntry[],
  bucket: "familiar" | "verification",
): string[] {
  const criteria = buildDomainSelectionCriteria(bucket);

  return registry
    .filter(
      (entry) =>
        entry.isActive &&
        criteria.usageRoles.includes(entry.usageRole),
    )
    .sort((left, right) => left.priority - right.priority)
    .map((entry) => entry.domain)
    .filter((domain, index, domains) => domains.indexOf(domain) === index);
}

function buildDomainSelectionCriteria(
  bucket: "familiar" | "verification",
): {
  usageRoles: string[];
} {
  return {
    usageRoles:
      bucket === "familiar"
        ? ["familiar_news"]
        : ["verification_news"],
  };
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
