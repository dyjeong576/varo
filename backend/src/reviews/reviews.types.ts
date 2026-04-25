export type ReviewRelevanceTier = "primary" | "reference" | "discard";
export type TopicScope = "domestic" | "foreign" | "multi_country" | "unknown";
export type RetrievalBucket = "familiar" | "verification" | "fallback";
export type SearchRoute = "korean_news" | "global_news" | "unsupported";
export type SearchProvider = "naver-search" | "tavily-search";

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
  searchRoute: SearchRoute;
  sourceProvider: SearchProvider;
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

export interface QueryRefinementResult {
  claimLanguageCode: string;
  coreClaim: string;
  generatedQueries: QueryArtifact[];
  searchRoute: SearchRoute;
  searchRouteReason: string;
  searchClaim: string;
  searchQueries: QueryArtifact[];
  topicScope: TopicScope;
  topicCountryCode: string | null;
  countryDetectionReason: string;
  isKoreaRelated: boolean;
  koreaRelevanceReason: string;
}

export interface SearchSourcesInput {
  searchRoute: SearchRoute;
  queries: QueryArtifact[];
  coreClaim: string;
  claimLanguageCode: string;
  userCountryCode: string | null;
  topicCountryCode: string | null;
  topicScope: TopicScope;
  domainRegistry: DomainRegistryEntry[];
}

export interface RelevanceFilteringInput {
  coreClaim: string;
  claimLanguageCode: string;
  searchRoute: SearchRoute;
  topicCountryCode: string | null;
  topicScope: TopicScope;
  candidates: SearchCandidate[];
}

export interface ExtractedSource {
  canonicalUrl: string;
  contentText: string;
  snippetText: string;
}
