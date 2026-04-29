export interface AnswerPreviewSummaryResponse {
  answerId: string;
  clientRequestId: string | null;
  rawCheck: string;
  status: string;
  currentStage: string;
  createdAt: string;
  selectedSourceCount: number;
  lastErrorCode: string | null;
}

export interface AnswerPreviewQueryArtifactResponse {
  id: string;
  text: string;
  rank: number;
}

export interface AnswerPreviewSourceResponse {
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

export interface AnswerPreviewEvidenceSnippetResponse {
  id: string;
  sourceId: string;
  snippetText: string;
  evidenceSummary: string | null;
}

export interface AnswerPreviewDetailResponse {
  answerId: string;
  clientRequestId: string | null;
  checkId: string;
  rawCheck: string;
  createdAt: string;
  status: string;
  currentStage: string;
  normalizedCheck: string;
  coreCheck: string;
  generatedQueries: AnswerPreviewQueryArtifactResponse[];

  sources: AnswerPreviewSourceResponse[];
  evidenceSnippets: AnswerPreviewEvidenceSnippetResponse[];
  searchedSourceCount: number;
  selectedSourceCount: number;
  discardedSourceCount: number;
  handoff: {
    coreCheck: string;
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

export type AnswerSourceCategory =
  | "official"
  | "press"
  | "social"
  | "analysis"
  | "other";

export interface AnswerPreviewSummary {
  answerId: string;
  clientRequestId: string | null;
  check: string;
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

export interface AnswerPreviewQueryArtifact {
  id: string;
  text: string;
  rank: number;
}

export interface AnswerPreviewSource {
  id: string;
  publisherName: string;
  politicalLeanLabel: string;
  politicalLeanClassName: string;
  title: string;
  sourceType: string;
  sourceTypeLabel: string;
  sourceCategory: AnswerSourceCategory;
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

export interface AnswerPreviewEvidenceSnippet {
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

export interface AnswerPreviewDetail {
  answerId: string;
  clientRequestId: string | null;
  checkId: string;
  check: string;
  normalizedCheck: string;
  createdAt: string;
  createdAtLabel: string;
  isOutOfScope: boolean;
  status: string;
  statusLabel: string;
  currentStage: string;
  currentStageLabel: string;
  statusTone: "blue" | "slate" | "red";
  pendingMessage: string;
  coreCheck: string;
  generatedQueries: AnswerPreviewQueryArtifact[];
  sources: AnswerPreviewSource[];
  evidenceSnippets: AnswerPreviewEvidenceSnippet[];
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

export type AnswerTaskStatus =
  | "pending"
  | "submitting"
  | "processing"
  | "succeeded"
  | "failed";

export interface AnswerTaskRecord {
  draftId: string;
  clientRequestId: string | null;
  check: string;
  status: AnswerTaskStatus;
  previewStatus: string;
  currentStage: string;
  startedAt: string;
  completedAt: string | null;
  answerId: string | null;
  answerCreatedAt: string | null;
  selectedSourceCount: number;
  lastErrorCode: string | null;
  errorMessage: string | null;
  notificationSent: boolean;
}
