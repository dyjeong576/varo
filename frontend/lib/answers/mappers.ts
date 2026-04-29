import {
  AnswerPreviewDetail,
  AnswerPreviewDetailResponse,
  AnswerPreviewEvidenceSnippet,
  AnswerPreviewSource,
  AnswerPreviewSourceResponse,
  AnswerPreviewSummary,
  AnswerPreviewSummaryResponse,
} from "@/lib/answers/types";
import { getSourcePoliticalLeanBadge } from "./source-political-lean";

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

export function getAnswerStatusLabel(status: string): string {
  switch (status) {
    case "partial":
      return "부분 완료";
    case "searching":
      return "수집 중";
    case "failed":
      return "처리 실패";
    case "completed":
      return "완료";
    case "out_of_scope":
      return "지원 범위 밖";
    default:
      return status;
  }
}

export function getAnswerStageLabel(stage: string): string {
  switch (stage) {
    case "query_refinement":
      return "질의 정제 중";
    case "searching":
      return "출처 검색 중";
    case "relevance_and_signal_classification":
      return "근거 신호 분류 중";
    case "handoff_ready":
      return "근거 수집 완료";
    case "scope_checked":
      return "범위 확인 완료";
    case "failed":
      return "실행 실패";
    default:
      return stage.replace(/_/g, " ");
  }
}

export function getAnswerStatusTone(
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

function getSourceCategory(sourceType: string): AnswerPreviewSource["sourceCategory"] {
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

function getStanceLabel(stance: AnswerPreviewSourceResponse["stance"]): string {
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

type AnswerResultResponse = NonNullable<AnswerPreviewDetailResponse["result"]>;

function getVerdictLabel(verdict: AnswerResultResponse["verdict"]): string {
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
  consensusLevel: AnswerResultResponse["consensusLevel"] | null,
): string {
  switch (consensusLevel) {
    case "high":
      return "높음";
    case "medium":
      return "중간";
    case "low":
      return "낮음";
    default:
      return "범위 밖";
  }
}

function mapSource(source: AnswerPreviewSourceResponse): AnswerPreviewSource {
  const politicalLeanBadge = getSourcePoliticalLeanBadge(source);

  return {
    id: source.id,
    publisherName: source.publisherName ?? "출처명 미상",
    politicalLeanLabel: politicalLeanBadge.label,
    politicalLeanClassName: politicalLeanBadge.className,
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
    retrievalBucket: source.retrievalBucket,
    retrievalBucketLabel: getRetrievalBucketLabel(source.retrievalBucket),
    domainRegistryMatched: source.domainRegistryMatched,
    stance: source.stance,
    stanceLabel: getStanceLabel(source.stance),
  };
}

function mapEvidenceSnippets(
  detail: AnswerPreviewDetailResponse,
  sources: AnswerPreviewSource[],
): AnswerPreviewEvidenceSnippet[] {
  return detail.evidenceSnippets.map((snippet) => {
    const source = sources.find((item) => item.id === snippet.sourceId);

    return {
      id: snippet.id,
      sourceId: snippet.sourceId,
      snippetText: snippet.snippetText,
      evidenceSummary: snippet.evidenceSummary ?? source?.relevanceReason ?? null,
      sourceTitle: source?.title ?? "제목 정보 없음",
      sourcePublisherName: source?.publisherName ?? "출처명 미상",
      sourceTypeLabel: source?.sourceTypeLabel ?? "기타",
      publishedAtLabel: source?.publishedAtLabel ?? "발행 시각 없음",
      url: source?.url ?? "#",
    };
  });
}

export function mapAnswerPreviewSummary(
  summary: AnswerPreviewSummaryResponse,
): AnswerPreviewSummary {
  const currentStageLabel = getAnswerStageLabel(summary.currentStage);

  return {
    answerId: summary.answerId,
    clientRequestId: summary.clientRequestId,
    check: summary.rawCheck,
    createdAt: summary.createdAt,
    createdAtLabel: formatDateTime(summary.createdAt),
    status: summary.status,
    statusLabel: getAnswerStatusLabel(summary.status),
    currentStage: summary.currentStage,
    currentStageLabel,
    selectedSourceCount: summary.selectedSourceCount,
    lastErrorCode: summary.lastErrorCode,
    subtitle:
      summary.status === "out_of_scope"
        ? "지원 범위 밖"
        : summary.selectedSourceCount > 0
        ? `선별 근거 ${summary.selectedSourceCount}건`
        : currentStageLabel,
  };
}

export function mapAnswerPreviewDetail(
  detail: AnswerPreviewDetailResponse,
): AnswerPreviewDetail {
  const sources = detail.sources.map(mapSource);
  const evidenceSnippets = mapEvidenceSnippets(detail, sources);
  const pendingMessage =
    detail.status === "out_of_scope"
      ? "현재 지원 범위 밖 check으로 기록되었습니다. 이 기록은 판단 없이 범위 확인 결과만 표시합니다."
      : detail.status === "failed"
      ? "임시 결과 생성이 중단되어 저장된 근거만 표시하고 있습니다."
      : detail.status === "searching"
      ? "출처 수집이 끝났고, 현재 수집된 출처 기준으로 근거 신호를 분류하고 있습니다."
      : "이 결과는 현재 수집된 출처 기준으로 계산된 임시 분석입니다.";
  const result = detail.result;

  return {
    answerId: detail.answerId,
    clientRequestId: detail.clientRequestId,
    checkId: detail.checkId,
    check: detail.rawCheck,
    normalizedCheck: detail.normalizedCheck,
    createdAt: detail.createdAt,
    createdAtLabel: formatDateTime(detail.createdAt),
    isOutOfScope: detail.status === "out_of_scope",
    status: detail.status,
    statusLabel: getAnswerStatusLabel(detail.status),
    currentStage: detail.currentStage,
    currentStageLabel: getAnswerStageLabel(detail.currentStage),
    statusTone: getAnswerStatusTone(detail.status),
    pendingMessage,
    coreCheck: detail.coreCheck,
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
    verdict: result?.verdict ?? null,
    verdictLabel: result ? getVerdictLabel(result.verdict) : null,
    confidenceScore: result?.confidenceScore ?? null,
    consensusLevel: result?.consensusLevel ?? null,
    consensusLabel: getConsensusLabel(result?.consensusLevel ?? null),
    analysisSummary: result?.analysisSummary ?? null,
    uncertaintySummary: result?.uncertaintySummary ?? null,
    uncertaintyItems: result?.uncertaintyItems ?? [],
    agreementCount: result?.agreementCount ?? 0,
    conflictCount: result?.conflictCount ?? 0,
    contextCount: result?.contextCount ?? 0,
    sourceBreakdown:
      result?.sourceBreakdown ?? {
        official: 0,
        press: 0,
        social: 0,
        analysis: 0,
        other: 0,
      },
    resultMode: result?.mode ?? null,
  };
}
