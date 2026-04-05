import {
  ReviewPreviewDetail,
  ReviewPreviewDetailResponse,
  ReviewPreviewEvidenceSnippet,
  ReviewPreviewSource,
  ReviewPreviewSourceResponse,
  ReviewPreviewSummary,
  ReviewPreviewSummaryResponse,
} from "@/lib/reviews/types";

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "시간 정보 없음";
  }

  return dateTimeFormatter.format(date);
}

export function getReviewStatusLabel(status: string): string {
  switch (status) {
    case "partial":
      return "부분 완료";
    case "searching":
      return "수집 중";
    case "failed":
      return "처리 실패";
    case "completed":
      return "완료";
    default:
      return status;
  }
}

export function getReviewStageLabel(stage: string): string {
  switch (stage) {
    case "query_refinement":
      return "질의 정제 중";
    case "searching":
      return "출처 검색 중";
    case "handoff_ready":
      return "근거 수집 완료";
    case "failed":
      return "실행 실패";
    default:
      return stage.replace(/_/g, " ");
  }
}

export function getReviewStatusTone(
  status: string,
): "blue" | "slate" | "red" {
  if (status === "failed") {
    return "red";
  }

  if (status === "partial" || status === "completed") {
    return "blue";
  }

  return "slate";
}

function getSourceCategory(sourceType: string): ReviewPreviewSource["sourceCategory"] {
  const normalized = sourceType.toLowerCase();

  if (normalized.includes("official")) {
    return "official";
  }

  if (normalized.includes("social")) {
    return "social";
  }

  if (normalized.includes("analysis")) {
    return "analysis";
  }

  if (normalized.includes("news") || normalized.includes("press")) {
    return "press";
  }

  return "other";
}

function getSourceTypeLabel(sourceType: string): string {
  switch (getSourceCategory(sourceType)) {
    case "official":
      return "공식";
    case "press":
      return "언론";
    case "social":
      return "소셜";
    case "analysis":
      return "해설";
    default:
      return "기타";
  }
}

function getRelevanceLabel(relevanceTier: string): string {
  switch (relevanceTier) {
    case "primary":
      return "핵심 근거";
    case "reference":
      return "보조 근거";
    case "discard":
      return "제외 후보";
    default:
      return relevanceTier;
  }
}

function getStanceLabel(stance: ReviewPreviewSourceResponse["stance"]): string {
  switch (stance) {
    case "support":
      return "지지 근거";
    case "conflict":
      return "충돌 근거";
    case "context":
      return "맥락 근거";
    default:
      return "판정 보류";
  }
}

function getRetrievalBucketLabel(retrievalBucket: string | null): string {
  switch (retrievalBucket) {
    case "familiar":
      return "친숙형 수집";
    case "verification":
      return "검증형 수집";
    case "fallback":
      return "fallback 수집";
    default:
      return "분류 전";
  }
}

function getTopicScopeLabel(topicScope: string): string {
  switch (topicScope) {
    case "domestic":
      return "국내 이슈";
    case "foreign":
      return "해외 이슈";
    case "multi_country":
      return "다중 국가 이슈";
    default:
      return "범위 판정 전";
  }
}

function getVerdictLabel(verdict: ReviewPreviewDetailResponse["result"]["verdict"]): string {
  switch (verdict) {
    case "Likely True":
      return "대체로 사실";
    case "Likely False":
      return "대체로 사실 아님";
    case "Mixed Evidence":
      return "근거 혼재";
    case "Unclear":
    default:
      return "불분명";
  }
}

function getConsensusLabel(
  consensusLevel: ReviewPreviewDetailResponse["result"]["consensusLevel"],
): string {
  switch (consensusLevel) {
    case "high":
      return "높음";
    case "medium":
      return "중간";
    case "low":
    default:
      return "낮음";
  }
}

function mapSource(source: ReviewPreviewSourceResponse): ReviewPreviewSource {
  return {
    id: source.id,
    publisherName: source.publisherName ?? "출처명 미상",
    title: source.rawTitle,
    sourceType: source.sourceType,
    sourceTypeLabel: getSourceTypeLabel(source.sourceType),
    sourceCategory: getSourceCategory(source.sourceType),
    url: source.originalUrl || source.canonicalUrl,
    publishedAt: source.publishedAt,
    publishedAtLabel: source.publishedAt
      ? formatDateTime(source.publishedAt)
      : "발행 시각 없음",
    snippet: source.rawSnippet,
    relevanceTier: source.relevanceTier,
    relevanceLabel: getRelevanceLabel(source.relevanceTier),
    relevanceReason: source.relevanceReason,
    originQueryIds: source.originQueryIds,
    sourceCountryCode: source.sourceCountryCode,
    retrievalBucket: source.retrievalBucket,
    retrievalBucketLabel: getRetrievalBucketLabel(source.retrievalBucket),
    domainRegistryMatched: source.domainRegistryMatched,
    stance: source.stance,
    stanceLabel: getStanceLabel(source.stance),
  };
}

function mapEvidenceSnippets(
  detail: ReviewPreviewDetailResponse,
  sources: ReviewPreviewSource[],
): ReviewPreviewEvidenceSnippet[] {
  return detail.evidenceSnippets.map((snippet) => {
    const source = sources.find((item) => item.id === snippet.sourceId);

    return {
      id: snippet.id,
      sourceId: snippet.sourceId,
      snippetText: snippet.snippetText,
      sourceTitle: source?.title ?? "제목 정보 없음",
      sourcePublisherName: source?.publisherName ?? "출처명 미상",
      sourceTypeLabel: source?.sourceTypeLabel ?? "기타",
      publishedAtLabel: source?.publishedAtLabel ?? "발행 시각 없음",
      url: source?.url ?? "#",
    };
  });
}

export function mapReviewPreviewSummary(
  summary: ReviewPreviewSummaryResponse,
): ReviewPreviewSummary {
  const currentStageLabel = getReviewStageLabel(summary.currentStage);

  return {
    reviewId: summary.reviewId,
    claim: summary.rawClaim,
    createdAt: summary.createdAt,
    createdAtLabel: formatDateTime(summary.createdAt),
    status: summary.status,
    statusLabel: getReviewStatusLabel(summary.status),
    currentStage: summary.currentStage,
    currentStageLabel,
    selectedSourceCount: summary.selectedSourceCount,
    lastErrorCode: summary.lastErrorCode,
    subtitle:
      summary.selectedSourceCount > 0
        ? `선별 근거 ${summary.selectedSourceCount}건`
        : currentStageLabel,
  };
}

export function mapReviewPreviewDetail(
  detail: ReviewPreviewDetailResponse,
): ReviewPreviewDetail {
  const sources = detail.sources.map(mapSource);
  const evidenceSnippets = mapEvidenceSnippets(detail, sources);
  const pendingMessage =
    detail.status === "failed"
      ? "임시 결과 생성이 중단되어 저장된 근거만 표시하고 있습니다."
      : "이 결과는 현재 수집된 출처 기준으로 계산된 임시 분석입니다.";

  return {
    reviewId: detail.reviewId,
    claimId: detail.claimId,
    claim: detail.rawClaim,
    normalizedClaim: detail.normalizedClaim,
    createdAt: detail.createdAt,
    createdAtLabel: formatDateTime(detail.createdAt),
    status: detail.status,
    statusLabel: getReviewStatusLabel(detail.status),
    currentStage: detail.currentStage,
    currentStageLabel: getReviewStageLabel(detail.currentStage),
    statusTone: getReviewStatusTone(detail.status),
    pendingMessage,
    coreClaim: detail.coreClaim,
    languageCode: detail.languageCode,
    claimLanguageCode: detail.claimLanguageCode,
    topicScope: detail.topicScope,
    topicScopeLabel: getTopicScopeLabel(detail.topicScope),
    topicCountryCode: detail.topicCountryCode,
    countryDetectionReason: detail.countryDetectionReason,
    generatedQueries: detail.generatedQueries,
    sources: sources.map((source) => {
      const evidenceSnippet = detail.evidenceSnippets.find(
        (snippet) => snippet.sourceId === source.id,
      );

      return {
        ...source,
        snippet: evidenceSnippet?.snippetText ?? source.snippet,
      };
    }),
    evidenceSnippets,
    searchedSourceCount: detail.searchedSourceCount,
    selectedSourceCount: detail.selectedSourceCount,
    discardedSourceCount: detail.discardedSourceCount,
    insufficiencyReason: detail.handoff.insufficiencyReason,
    verdict: detail.result.verdict,
    verdictLabel: getVerdictLabel(detail.result.verdict),
    confidenceScore: detail.result.confidenceScore,
    consensusLevel: detail.result.consensusLevel,
    consensusLabel: getConsensusLabel(detail.result.consensusLevel),
    analysisSummary: detail.result.analysisSummary,
    uncertaintySummary: detail.result.uncertaintySummary,
    uncertaintyItems: detail.result.uncertaintyItems,
    agreementCount: detail.result.agreementCount,
    conflictCount: detail.result.conflictCount,
    contextCount: detail.result.contextCount,
    sourceBreakdown: detail.result.sourceBreakdown,
    resultMode: detail.result.mode,
  };
}
