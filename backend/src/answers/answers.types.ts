export type AnswerRelevanceTier = "primary" | "reference" | "discard";
export type RetrievalBucket = "familiar" | "verification" | "fallback";
export type SearchRoute = "supported" | "unsupported" | "llm_direct";
export type SearchProvider = "naver-search" | "tavily-search" | "perplexity-sonar";
export type SourcePoliticalLean =
  | "progressive"
  | "centrist"
  | "conservative"
  | "business";
export type QueryPurpose =
  | "check_specific"
  | "current_state"
  | "primary_source"
  | "contradiction_or_update";
export type AnswerCheckType =
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
  sourceKind: string;
  usageRole: string;
  priority: number;
  isActive: boolean;
  publisherName?: string;
  politicalLean?: SourcePoliticalLean;
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
  retrievalBucket: RetrievalBucket;
  domainRegistryId: string | null;
  sourcePoliticalLean?: SourcePoliticalLean | null;
  relevanceTier?: AnswerRelevanceTier;
  relevanceReason?: string | null;
  contentText?: string | null;
}

export interface QueryRefinementResult {
  coreCheck: string;
  normalizedCheck: string;
  checkType: AnswerCheckType;
  isFactCheckQuestion: boolean;
  searchPlan: SearchPlan;
  generatedQueries: QueryArtifact[];
  searchRoute: SearchRoute;
  searchRouteReason: string;
}

export interface SearchSourcesInput {
  searchRoute: SearchRoute;
  queries: QueryArtifact[];
  coreCheck: string;
  domainRegistry: DomainRegistryEntry[];
}

export interface RelevanceSignalClassificationInput {
  coreCheck: string;
  searchRoute: SearchRoute;
  candidates: SearchCandidate[];
  searchPlan: SearchPlan | null;
}

export interface RelevanceSignalClassificationResult {
  relevanceCandidates: SearchCandidate[];
  evidenceSignals: EvidenceSignal[];
  answerSummary?: AnswerGeneratedSummary | null;
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
  coreCheck: string;
  searchPlan: SearchPlan | null;
  sources: EvidenceSignalSourceInput[];
}

export interface EvidenceSignal {
  sourceId: string;
  snippetId: string | null;
  stanceToCheck: EvidenceSignalStance;
  temporalRole: EvidenceSignalTemporalRole;
  updateType: EvidenceSignalUpdateType;
  currentAnswerImpact: EvidenceSignalImpact;
  reason: string;
}

export interface AnswerGeneratedSummary {
  analysisSummary: string;
  uncertaintySummary: string;
  uncertaintyItems: string[];
}

export interface DirectAnswerCitation {
  url: string;
}

export interface DirectAnswerResult {
  answerText: string;
  citations: DirectAnswerCitation[];
}
