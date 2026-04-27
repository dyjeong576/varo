export type ReviewRelevanceTier = "primary" | "reference" | "discard";
export type TopicScope = "domestic" | "foreign" | "multi_country" | "unknown";
export type RetrievalBucket = "familiar" | "verification" | "fallback";
export type SearchRoute = "korean_news" | "global_news" | "unsupported";
export type SearchProvider = "naver-search" | "tavily-search";
export type QueryPurpose =
  | "claim_specific"
  | "current_state"
  | "primary_source"
  | "contradiction_or_update";
export type ReviewClaimType =
  | "scheduled_event"
  | "current_status"
  | "statistic"
  | "quote"
  | "policy"
  | "corporate_action"
  | "incident"
  | "general_fact";
export type EvidenceSignalStance =
  | "supports"
  | "contradicts"
  | "updates"
  | "context"
  | "unknown";
export type EvidenceSignalTemporalRole =
  | "past_plan"
  | "current_status"
  | "latest_update"
  | "official_statement"
  | "background";
export type EvidenceSignalUpdateType =
  | "delay"
  | "cancellation"
  | "correction"
  | "confirmation"
  | "none";
export type EvidenceSignalImpact =
  | "strengthens"
  | "weakens"
  | "overrides"
  | "neutral";

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
  purpose?: QueryPurpose;
}

export interface SearchPlanQueryArtifact {
  id: string;
  purpose: QueryPurpose;
  query: string;
  priority: number;
}

export interface SearchPlan {
  normalizedClaim: string;
  claimType: ReviewClaimType;
  verificationGoal: string;
  searchRoute: SearchRoute;
  queries: SearchPlanQueryArtifact[];
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
  originQueryPurposes?: QueryPurpose[];
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
  normalizedClaim: string;
  claimType: ReviewClaimType;
  verificationGoal: string;
  searchPlan: SearchPlan;
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

export interface EvidenceSignalSourceInput {
  sourceId: string;
  sourceType: string;
  publisherName: string | null;
  publishedAt: string | null;
  rawTitle: string;
  rawSnippet: string | null;
  originQueryIds: string[];
  retrievalBucket: RetrievalBucket;
  evidenceSnippetText: string;
}

export interface EvidenceSignalClassificationInput {
  coreClaim: string;
  claimLanguageCode: string;
  searchPlan: SearchPlan | null;
  sources: EvidenceSignalSourceInput[];
}

export interface EvidenceSignal {
  sourceId: string;
  snippetId: string | null;
  stanceToClaim: EvidenceSignalStance;
  temporalRole: EvidenceSignalTemporalRole;
  updateType: EvidenceSignalUpdateType;
  currentAnswerImpact: EvidenceSignalImpact;
  reason: string;
}
