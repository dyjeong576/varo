import { EvidenceSnippet, Source } from "@prisma/client";
import { EvidenceSignal, QueryPurpose, SearchPlan } from "../reviews.types";

export type ReviewResultVerdict =
  | "Likely True"
  | "Mixed Evidence"
  | "Unclear"
  | "Likely False";
export type ReviewSourceStance = "support" | "conflict" | "context" | "unknown";
export type ReviewConsensusLevel = "high" | "medium" | "low";
export type ReviewSourceCategory =
  | "official"
  | "press"
  | "social"
  | "analysis"
  | "other";

interface ResultAssemblerInput {
  coreClaim: string;
  rawClaim: string;
  sources: Source[];
  evidenceSnippets: EvidenceSnippet[];
  insufficiencyReason: string | null;
  searchPlan?: SearchPlan | null;
  evidenceSignals?: EvidenceSignal[];
}

interface AssembledSourceBreakdown {
  official: number;
  press: number;
  social: number;
  analysis: number;
  other: number;
}

interface AssembledReviewResult {
  mode: "rule_based_preview";
  verdict: ReviewResultVerdict;
  confidenceScore: number;
  consensusLevel: ReviewConsensusLevel;
  analysisSummary: string;
  uncertaintySummary: string;
  uncertaintyItems: string[];
  agreementCount: number;
  conflictCount: number;
  contextCount: number;
  sourceBreakdown: AssembledSourceBreakdown;
}

export interface AssembledReviewResultPayload {
  sourceStances: Record<string, ReviewSourceStance>;
  result: AssembledReviewResult;
}

const CONFLICT_KEYWORDS = [
  "정정",
  "반박",
  "부인",
  "오보",
  "사실 아님",
  "사실이 아니다",
  "미확인",
  "허위",
  "왜곡",
  "아니다",
  "not true",
  "false",
  "incorrect",
  "denied",
  "deny",
  "refuted",
  "unconfirmed",
  "debunked",
  "misleading",
  "correction",
];

const UPDATE_KEYWORDS = [
  "연기",
  "미뤄",
  "변경",
  "일정 변경",
  "다음 달",
  "다음달",
  "한 달 뒤",
  "재연기",
  "delayed",
  "postponed",
  "rescheduled",
  "pushed back",
  "moved to",
  "next month",
  "slipped",
];

function categorizeSourceType(sourceType: string): ReviewSourceCategory {
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

function buildSourceText(source: Source, evidenceSnippets: EvidenceSnippet[]): string {
  const snippetTexts = evidenceSnippets
    .filter((snippet) => snippet.sourceId === source.id)
    .map((snippet) => snippet.snippetText);

  return [
    source.rawTitle,
    source.rawSnippet,
    ...snippetTexts,
    source.contentText,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .toLowerCase();
}

function includesConflictKeyword(text: string): boolean {
  return CONFLICT_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function includesUpdateKeyword(text: string): boolean {
  return UPDATE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function buildQueryPurposesById(searchPlan?: SearchPlan | null): Map<string, QueryPurpose> {
  return new Map((searchPlan?.queries ?? []).map((query) => [query.id, query.purpose]));
}

function parseOriginQueryIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sourceHasQueryPurpose(
  source: Source,
  queryPurposesById: Map<string, QueryPurpose>,
  purpose: QueryPurpose,
): boolean {
  return parseOriginQueryIds(source.originQueryIds).some(
    (queryId) => queryPurposesById.get(queryId) === purpose,
  );
}

function buildSignalBySourceId(
  evidenceSignals?: EvidenceSignal[],
): Map<string, EvidenceSignal> {
  return new Map((evidenceSignals ?? []).map((signal) => [signal.sourceId, signal]));
}

function mapSignalToSourceStance(signal: EvidenceSignal): ReviewSourceStance {
  if (
    signal.stanceToClaim === "contradicts" ||
    signal.stanceToClaim === "updates" ||
    signal.currentAnswerImpact === "weakens" ||
    signal.currentAnswerImpact === "overrides"
  ) {
    return "conflict";
  }

  if (
    signal.stanceToClaim === "supports" ||
    signal.currentAnswerImpact === "strengthens"
  ) {
    return "support";
  }

  if (signal.stanceToClaim === "context") {
    return "context";
  }

  return "unknown";
}

function signalHasCurrentUpdateConflict(signal?: EvidenceSignal): boolean {
  return Boolean(
    signal &&
      (signal.temporalRole === "latest_update" ||
        signal.temporalRole === "current_status") &&
      (signal.currentAnswerImpact === "weakens" ||
        signal.currentAnswerImpact === "overrides" ||
        signal.updateType === "delay" ||
        signal.updateType === "cancellation" ||
        signal.updateType === "correction"),
  );
}

function hasScheduledEventUpdateSignal(params: {
  source: Source;
  evidenceSnippets: EvidenceSnippet[];
  queryPurposesById: Map<string, QueryPurpose>;
  isScheduledEvent: boolean;
}): boolean {
  if (!params.isScheduledEvent) {
    return false;
  }

  const text = buildSourceText(params.source, params.evidenceSnippets);
  if (!text || !includesUpdateKeyword(text)) {
    return false;
  }

  return (
    sourceHasQueryPurpose(
      params.source,
      params.queryPurposesById,
      "contradiction_or_update",
    ) ||
    sourceHasQueryPurpose(params.source, params.queryPurposesById, "current_state")
  );
}

function determineSourceStance(
  source: Source,
  evidenceSnippets: EvidenceSnippet[],
  queryPurposesById: Map<string, QueryPurpose>,
  isScheduledEvent: boolean,
): ReviewSourceStance {
  if (source.relevanceTier === "discard") {
    return "unknown";
  }

  if (
    hasScheduledEventUpdateSignal({
      source,
      evidenceSnippets,
      queryPurposesById,
      isScheduledEvent,
    })
  ) {
    return "conflict";
  }

  const text = buildSourceText(source, evidenceSnippets);
  if (text && includesConflictKeyword(text)) {
    return "conflict";
  }

  const category = categorizeSourceType(source.sourceType);
  if (
    source.fetchStatus === "fetched" &&
    (source.relevanceTier === "primary" ||
      source.retrievalBucket === "verification" ||
      category === "official")
  ) {
    return "support";
  }

  if (
    source.relevanceTier === "reference" ||
    Boolean(source.rawSnippet || source.contentText || text)
  ) {
    return "context";
  }

  return "unknown";
}

function buildSourceBreakdown(
  sources: Source[],
  sourceStances: Record<string, ReviewSourceStance>,
): AssembledSourceBreakdown {
  return sources.reduce<AssembledSourceBreakdown>(
    (acc, source) => {
      if (source.relevanceTier === "discard" || sourceStances[source.id] === "unknown") {
        return acc;
      }

      const category = categorizeSourceType(source.sourceType);
      acc[category] += 1;
      return acc;
    },
    {
      official: 0,
      press: 0,
      social: 0,
      analysis: 0,
      other: 0,
    },
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildVerdict(params: {
  supportCount: number;
  conflictCount: number;
  fetchedEvidenceCount: number;
  hasHighTrustSource: boolean;
}): ReviewResultVerdict {
  const { supportCount, conflictCount, fetchedEvidenceCount, hasHighTrustSource } = params;

  if (fetchedEvidenceCount < 1) {
    return "Unclear";
  }

  if (supportCount >= 1 && conflictCount >= 1) {
    return "Mixed Evidence";
  }

  if (supportCount >= 2 && conflictCount === 0 && hasHighTrustSource) {
    return "Likely True";
  }

  if (conflictCount >= 2 && supportCount === 0 && hasHighTrustSource) {
    return "Likely False";
  }

  return "Unclear";
}

function buildConfidenceScore(params: {
  verdict: ReviewResultVerdict;
  fetchedEvidenceCount: number;
  verificationCount: number;
  officialCount: number;
  discardCount: number;
  supportCount: number;
  conflictCount: number;
  hasHighTrustSource: boolean;
  hasCurrentUpdateConflict: boolean;
}): number {
  const {
    verdict,
    fetchedEvidenceCount,
    verificationCount,
    officialCount,
    discardCount,
    supportCount,
    conflictCount,
    hasHighTrustSource,
    hasCurrentUpdateConflict,
  } = params;

  let score = 35;
  score += Math.min(28, verificationCount * 12);
  score += Math.min(16, officialCount * 8);
  score += Math.min(20, fetchedEvidenceCount * 6);
  score -= Math.min(12, discardCount * 2);

  if (supportCount > 0 && conflictCount > 0) {
    score -= 10;
  } else if (verdict === "Likely True" || verdict === "Likely False") {
    score += 8;
  }

  if (!hasHighTrustSource) {
    score -= 6;
  }

  if (verdict === "Unclear") {
    score -= 4;
  }

  if (hasCurrentUpdateConflict) {
    score -= 18;
  }

  return clamp(Math.round(score), 35, 98);
}

function buildConsensusLevel(
  verdict: ReviewResultVerdict,
  supportCount: number,
  conflictCount: number,
  hasCurrentUpdateConflict: boolean,
): ReviewConsensusLevel {
  if (hasCurrentUpdateConflict) {
    return "low";
  }

  if (verdict === "Unclear") {
    return "low";
  }

  if (verdict === "Mixed Evidence") {
    return "medium";
  }

  return supportCount >= 2 || conflictCount >= 2 ? "high" : "medium";
}

function getPublishedAtTime(source: Source): number {
  return source.publishedAt?.getTime() ?? 0;
}

function pickLatestSource(sources: Source[]): Source | null {
  return [...sources].sort(
    (left, right) => getPublishedAtTime(right) - getPublishedAtTime(left),
  )[0] ?? null;
}

function formatPublishedAt(source: Source | null): string | null {
  if (!source?.publishedAt) {
    return null;
  }

  return `${source.publishedAt.getMonth() + 1}월 ${source.publishedAt.getDate()}일 보도`;
}

function buildOfficialSourceSentence(params: {
  officialCount: number;
  verificationCount: number;
}): string {
  if (params.officialCount > 0) {
    return "현재 수집된 자료 안에서는 공식 발표/공식 출처가 확인됐습니다.";
  }

  if (params.verificationCount > 0) {
    return "현재 수집된 자료 안에서는 공식 발표는 아직 확인되지 않았지만, 검증 성격의 출처는 포함되어 있습니다.";
  }

  return "현재 수집된 자료 안에서는 공식 발표/공식 출처는 아직 확인되지 않았습니다.";
}

function buildAnalysisSummary(params: {
  coreClaim: string;
  verdict: ReviewResultVerdict;
  supportSources: Source[];
  conflictSources: Source[];
  contextSources: Source[];
  verificationCount: number;
  officialCount: number;
  hasCurrentUpdateConflict: boolean;
  isScheduledEvent: boolean;
}): string {
  const {
    coreClaim,
    verdict,
    supportSources,
    conflictSources,
    contextSources,
    verificationCount,
    officialCount,
    hasCurrentUpdateConflict,
    isScheduledEvent,
  } = params;
  const officialSourceSentence = buildOfficialSourceSentence({
    officialCount,
    verificationCount,
  });

  if (isScheduledEvent && hasCurrentUpdateConflict) {
    const latestSupportSource = pickLatestSource(supportSources);
    const latestConflictSource = pickLatestSource(conflictSources);
    const supportDate = formatPublishedAt(latestSupportSource);
    const conflictDate = formatPublishedAt(latestConflictSource);
    const updateSentence =
      supportSources.length > 0
        ? `${supportDate ?? "초기/과거 보도"}는 이 주장을 뒷받침하지만, ${conflictDate ?? "더 최근 보도"}에서는 일정 연기 또는 변경 신호가 확인됩니다.`
        : `${conflictDate ?? "최신 상태를 다룬 보도"}에서 일정 연기 또는 변경 신호가 확인됩니다.`;

    return [
      `현재 수집된 출처 기준으로는 "${coreClaim}"를 그대로 단정하기 어렵습니다.`,
      updateSentence,
      officialSourceSentence,
      "따라서 현재는 기존 공개 일정 또는 공개 예정 보도가 있었지만 최근 연기 보도가 나온 상태로 보는 것이 적절합니다.",
      "이 요약은 현재 저장된 출처와 근거 스니펫만 기반으로 한 임시 요약입니다.",
    ].join(" ");
  }

  const verdictLead: Record<ReviewResultVerdict, string> = {
    "Likely True": `현재 수집된 출처 기준으로는 "${coreClaim}"에 부합하는 근거가 더 우세합니다.`,
    "Likely False": `현재 수집된 출처 기준으로는 "${coreClaim}"와 맞지 않는 근거가 더 우세합니다.`,
    "Mixed Evidence": `현재 수집된 출처 기준으로는 "${coreClaim}"에 대한 근거가 엇갈립니다.`,
    Unclear: `현재 수집된 출처만으로는 "${coreClaim}"에 답하기 어렵습니다.`,
  };

  const evidenceSentence =
    supportSources.length > 0 && conflictSources.length > 0
      ? "일부 출처는 이 주장을 뒷받침하지만, 다른 출처에서는 반박·정정·업데이트 신호가 함께 확인됩니다."
      : supportSources.length > 0
        ? "관련 출처들은 대체로 이 주장과 같은 방향의 내용을 담고 있습니다."
        : conflictSources.length > 0
          ? "관련 출처들은 대체로 이 주장과 맞지 않는 내용이나 반박 신호를 담고 있습니다."
          : contextSources.length > 0
            ? "수집된 출처는 배경 정보에 가깝고, 질문에 직접 답할 근거는 아직 부족합니다."
            : "질문에 직접 답할 만한 근거가 충분히 수집되지 않았습니다.";

  const conclusion: Record<ReviewResultVerdict, string> = {
    "Likely True":
      "따라서 현재는 이 주장을 수집 출처 기준으로는 가능성이 높은 설명으로 볼 수 있습니다.",
    "Likely False":
      "따라서 현재는 이 주장을 그대로 받아들이기보다, 수집된 반박 근거를 먼저 확인하는 것이 적절합니다.",
    "Mixed Evidence":
      "따라서 현재는 한쪽 결론으로 단정하기보다, 최신 출처와 공식 출처를 함께 확인하는 것이 적절합니다.",
    Unclear:
      "따라서 현재는 결론을 보류하고 추가 출처를 확인하는 것이 적절합니다.",
  };

  return [
    verdictLead[verdict],
    evidenceSentence,
    officialSourceSentence,
    conclusion[verdict],
    "이 요약은 현재 저장된 출처와 근거 스니펫만 기반으로 한 임시 요약입니다.",
  ].join(" ");
}

function buildUncertaintyItems(params: {
  insufficiencyReason: string | null;
  verdict: ReviewResultVerdict;
  fetchedEvidenceCount: number;
  verificationCount: number;
  contextCount: number;
  supportCount: number;
  conflictCount: number;
  discardCount: number;
  hasCurrentUpdateConflict: boolean;
}): string[] {
  const items: string[] = [];

  if (params.insufficiencyReason) {
    items.push(params.insufficiencyReason);
  }

  if (params.verificationCount === 0) {
    items.push("verification 또는 공식 출처가 충분하지 않습니다.");
  }

  if (params.verdict === "Mixed Evidence") {
    items.push("지지와 충돌 근거가 함께 있어 단일 결론으로 보기 어렵습니다.");
  }

  if (params.hasCurrentUpdateConflict) {
    items.push("최신 업데이트/연기 신호가 있어 과거 보도 합의만으로 현재 기준 결론을 강화하지 않습니다.");
  }

  if (params.fetchedEvidenceCount < 2) {
    items.push("추출 가능한 evidence 수가 적어 결과 안정성이 낮습니다.");
  }

  if (params.contextCount > params.supportCount + params.conflictCount) {
    items.push("맥락 보완형 기사 비중이 높아 직접 입증력은 제한적일 수 있습니다.");
  }

  if (params.discardCount > 0) {
    items.push(`${params.discardCount}건의 후보는 관련성이 낮아 제외됐습니다.`);
  }

  return items.slice(0, 3);
}

function buildUncertaintySummary(items: string[]): string {
  if (items.length === 0) {
    return "현재 결과는 수집된 출처 기준 임시 분석이며, 이후 interpretation 단계에서 근거 간 관계가 다시 정리될 수 있습니다.";
  }

  return `${items[0]} 이 결과는 현재 저장된 source와 snippet에 기반한 임시 결과이므로 추가 근거가 들어오면 해석 강도가 달라질 수 있습니다.`;
}

export function assembleReviewResult(
  input: ResultAssemblerInput,
): AssembledReviewResultPayload {
  const queryPurposesById = buildQueryPurposesById(input.searchPlan);
  const isScheduledEvent = input.searchPlan?.claimType === "scheduled_event";
  const signalBySourceId = buildSignalBySourceId(input.evidenceSignals);
  const sourceStances = input.sources.reduce<Record<string, ReviewSourceStance>>(
    (acc, source) => {
      const signal = signalBySourceId.get(source.id);
      acc[source.id] = signal
        ? mapSignalToSourceStance(signal)
        : determineSourceStance(
            source,
            input.evidenceSnippets,
            queryPurposesById,
            isScheduledEvent,
          );
      return acc;
    },
    {},
  );
  const hasCurrentUpdateConflict = input.sources.some(
    (source) => {
      if (sourceStances[source.id] !== "conflict") {
        return false;
      }

      return (
        signalHasCurrentUpdateConflict(signalBySourceId.get(source.id)) ||
        hasScheduledEventUpdateSignal({
          source,
          evidenceSnippets: input.evidenceSnippets,
          queryPurposesById,
          isScheduledEvent,
        })
      );
    },
  );

  const supportSources = input.sources.filter(
    (source) => sourceStances[source.id] === "support",
  );
  const conflictSources = input.sources.filter(
    (source) => sourceStances[source.id] === "conflict",
  );
  const contextSources = input.sources.filter(
    (source) => sourceStances[source.id] === "context",
  );
  const discardCount = input.sources.filter(
    (source) => source.relevanceTier === "discard",
  ).length;
  const fetchedEvidenceCount = input.evidenceSnippets.length;
  const verificationCount = input.sources.filter(
    (source) =>
      source.retrievalBucket === "verification" ||
      categorizeSourceType(source.sourceType) === "official",
  ).length;
  const officialCount = input.sources.filter(
    (source) => categorizeSourceType(source.sourceType) === "official",
  ).length;
  const hasHighTrustSource =
    verificationCount > 0 &&
    input.sources.some(
      (source) =>
        sourceStances[source.id] !== "unknown" &&
        (source.retrievalBucket === "verification" ||
          categorizeSourceType(source.sourceType) === "official"),
    );

  const verdict = buildVerdict({
    supportCount: supportSources.length,
    conflictCount: conflictSources.length,
    fetchedEvidenceCount,
    hasHighTrustSource,
  });
  const sourceBreakdown = buildSourceBreakdown(input.sources, sourceStances);
  const uncertaintyItems = buildUncertaintyItems({
    insufficiencyReason: input.insufficiencyReason,
    verdict,
    fetchedEvidenceCount,
    verificationCount,
    contextCount: contextSources.length,
    supportCount: supportSources.length,
    conflictCount: conflictSources.length,
    discardCount,
    hasCurrentUpdateConflict,
  });

  return {
    sourceStances,
    result: {
      mode: "rule_based_preview",
      verdict,
      confidenceScore: buildConfidenceScore({
        verdict,
        fetchedEvidenceCount,
        verificationCount,
        officialCount,
        discardCount,
        supportCount: supportSources.length,
        conflictCount: conflictSources.length,
        hasHighTrustSource,
        hasCurrentUpdateConflict,
      }),
      consensusLevel: buildConsensusLevel(
        verdict,
        supportSources.length,
        conflictSources.length,
        hasCurrentUpdateConflict,
      ),
      analysisSummary: buildAnalysisSummary({
        coreClaim: input.coreClaim || input.rawClaim,
        verdict,
        supportSources,
        conflictSources,
        contextSources,
        verificationCount,
        officialCount,
        hasCurrentUpdateConflict,
        isScheduledEvent,
      }),
      uncertaintySummary: buildUncertaintySummary(uncertaintyItems),
      uncertaintyItems,
      agreementCount: supportSources.length,
      conflictCount: conflictSources.length,
      contextCount: contextSources.length,
      sourceBreakdown,
    },
  };
}
