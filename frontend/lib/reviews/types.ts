export interface ReviewPreviewSummaryResponse {
  reviewId: string;
  clientRequestId: string | null;
  rawClaim: string;
  status: string;
  currentStage: string;
  createdAt: string;
  selectedSourceCount: number;
  lastErrorCode: string | null;
}

export interface ReviewPreviewQueryArtifactResponse {
  id: string;
  text: string;
  rank: number;
}

export interface ReviewPreviewSourceResponse {
  id: string;
  sourceType: string;
  publisherName: string | null;
  canonicalUrl: string;
  originalUrl: string;
  publishedAt: string | null;
  rawTitle: string;
  rawSnippet: string | null;
  relevanceTier: string;
  relevanceReason: string | null;
  originQueryIds: string[];
  retrievalBucket: string | null;
  domainRegistryMatched: boolean;
  stance: "support" | "conflict" | "context" | "unknown";
}

export interface ReviewPreviewEvidenceSnippetResponse {
  id: string;
  sourceId: string;
  snippetText: string;
  evidenceSummary: string | null;
}

export interface ReviewPreviewDetailResponse {
  reviewId: string;
  clientRequestId: string | null;
  claimId: string;
  rawClaim: string;
  createdAt: string;
  status: string;
  currentStage: string;
  normalizedClaim: string;
  coreClaim: string;
  generatedQueries: ReviewQueryArtifact[];

  sources: ReviewPreviewSourceResponse[];
  evidenceSnippets: ReviewPreviewEvidenceSnippetResponse[];
  searchedSourceCount: number;
  selectedSourceCount: number;
  discardedSourceCount: number;
  handoff: {
    coreClaim: string;
    sourceIds: string[];
    snippetIds: string[];
    insufficiencyReason: string | null;
  };
  result: {
    mode: "rule_based_preview";
    verdict: "Likely True" | "Mixed Evidence" | "Unclear" | "Likely False";
    confidenceScore: number;
    consensusLevel: "high" | "medium" | "low";
    analysisSummary: string;
    uncertaintySummary: string;
    uncertaintyItems: string[];
    agreementCount: number;
    conflictCount: number;
    contextCount: number;
    sourceBreakdown: {
      official: number;
      press: number;
      social: number;
      analysis: number;
      other: number;
    };
  } | null;
}

export type ReviewSourceCategory =
  | "official"
  | "press"
  | "social"
  | "analysis"
  | "other";

export interface ReviewPreviewSummary {
  reviewId: string;
  clientRequestId: string | null;
  claim: string;
  createdAt: string;
  createdAtLabel: string;
  status: string;
  statusLabel: string;
  currentStage: string;
  currentStageLabel: string;
  selectedSourceCount: number;
  lastErrorCode: string | null;
  subtitle: string;
}

export interface ReviewPreviewQueryArtifact {
  id: string;
  text: string;
  rank: number;
}

export interface ReviewPreviewSource {
  id: string;
  publisherName: string;
  title: string;
  sourceType: string;
  sourceTypeLabel: string;
  sourceCategory: ReviewSourceCategory;
  url: string;
  publishedAt: string | null;
  publishedAtLabel: string;
  snippet: string | null;
  relevanceTier: string;
  relevanceLabel: string;
  relevanceReason: string | null;
  originQueryIds: string[];
  retrievalBucket: string | null;
  retrievalBucketLabel: string;
  domainRegistryMatched: boolean;
  stance: "support" | "conflict" | "context" | "unknown";
  stanceLabel: string;
}

export interface ReviewPreviewEvidenceSnippet {
  id: string;
  sourceId: string;
  snippetText: string;
  evidenceSummary: string | null;
  sourceTitle: string;
  sourcePublisherName: string;
  sourceTypeLabel: string;
  publishedAtLabel: string;
  url: string;
}

export interface ReviewPreviewDetail {
  reviewId: string;
  clientRequestId: string | null;
  claimId: string;
  claim: string;
  normalizedClaim: string;
  createdAt: string;
  createdAtLabel: string;
  isOutOfScope: boolean;
  status: string;
  statusLabel: string;
  currentStage: string;
  currentStageLabel: string;
  statusTone: "blue" | "slate" | "red";
  pendingMessage: string;
  coreClaim: string;
  generatedQueries: ReviewPreviewQueryArtifact[];
  sources: ReviewPreviewSource[];
  evidenceSnippets: ReviewPreviewEvidenceSnippet[];
  searchedSourceCount: number;
  selectedSourceCount: number;
  discardedSourceCount: number;
  insufficiencyReason: string | null;
  verdict: "Likely True" | "Mixed Evidence" | "Unclear" | "Likely False" | null;
  verdictLabel: string | null;
  confidenceScore: number | null;
  consensusLevel: "high" | "medium" | "low" | null;
  consensusLabel: string;
  analysisSummary: string | null;
  uncertaintySummary: string | null;
  uncertaintyItems: string[];
  agreementCount: number;
  conflictCount: number;
  contextCount: number;
  sourceBreakdown: {
    official: number;
    press: number;
    social: number;
    analysis: number;
    other: number;
  };
  resultMode: "rule_based_preview" | null;
}

export type ReviewTaskStatus =
  | "pending"
  | "submitting"
  | "processing"
  | "succeeded"
  | "failed";

export interface ReviewTaskRecord {
  draftId: string;
  clientRequestId: string | null;
  claim: string;
  status: ReviewTaskStatus;
  previewStatus: string;
  currentStage: string;
  startedAt: string;
  completedAt: string | null;
  reviewId: string | null;
  reviewCreatedAt: string | null;
  selectedSourceCount: number;
  lastErrorCode: string | null;
  errorMessage: string | null;
  notificationSent: boolean;
}
