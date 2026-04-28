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

  if (signal.stanceToClaim === "context" || signal.stanceToClaim === "updates") {
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
  hasCurrentUpdateConflict: boolean,
): ReviewConsensusLevel {
  if (hasCurrentUpdateConflict || verdict === "Unclear" || verdict === "Likely False") {
    return "low";
  }

  if (verdict === "Mixed Evidence") {
    return "medium";
  }

  return supportCount >= 2 ? "high" : "medium";
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
    return "공식 출처에서도 이를 확인했습니다.";
  }

  if (params.verificationCount > 0) {
    return "검증 성격의 출처가 포함되어 있습니다.";
  }

  return "";
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
  const officialLine = buildOfficialSourceSentence({ officialCount, verificationCount });

  if (isScheduledEvent && hasCurrentUpdateConflict) {
    const latestSupportSource = pickLatestSource(supportSources);
    const latestConflictSource = pickLatestSource(conflictSources);
    const supportDate = formatPublishedAt(latestSupportSource);
    const conflictDate = formatPublishedAt(latestConflictSource);
    const updateSentence =
      supportSources.length > 0
        ? `${supportDate ?? "초기 보도"}에서는 이 내용이 예정되어 있었지만, ${conflictDate ?? "최근 보도"}에서 일정 변경 또는 연기 신호가 확인됩니다.`
        : `${conflictDate ?? "최근 보도"}에서 일정 변경 또는 연기 신호가 확인됩니다.`;

    return [
      `"${coreClaim}"에 대해 보도가 엇갈리고 있습니다.`,
      updateSentence,
      officialLine,
      "현재 상태를 정확히 파악하려면 최신 원문을 직접 확인해 보세요.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const verdictLead: Record<ReviewResultVerdict, string> = {
    "Likely True": `수집된 뉴스들이 "${coreClaim}"을 뒷받침하고 있습니다.`,
    "Likely False": `수집된 뉴스들은 대체로 "${coreClaim}"과 다른 내용을 담고 있습니다.`,
    "Mixed Evidence": `"${coreClaim}"에 대한 보도가 엇갈리고 있습니다.`,
    Unclear: `수집된 자료만으로는 "${coreClaim}"을 정확히 판단하기 어렵습니다.`,
  };

  const supportCount = supportSources.length;
  const conflictCount = conflictSources.length;
  const evidenceSentence =
    supportCount > 0 && conflictCount > 0
      ? `${supportCount}건의 기사가 이를 뒷받침하지만, ${conflictCount}건에서는 반박 또는 다른 내용이 확인됩니다.`
      : supportCount > 0
        ? `${supportCount}건의 기사가 같은 방향을 가리키고 있으며, 반박 보도는 현재 확인되지 않습니다.`
        : conflictCount > 0
          ? `${conflictCount}건의 기사에서 이와 다른 내용이 보도됐습니다.`
          : contextSources.length > 0
            ? "관련 배경 정보는 수집됐지만, 질문에 직접 답할 근거는 아직 부족합니다."
            : "관련 기사를 충분히 찾지 못했습니다.";

  const conclusion: Record<ReviewResultVerdict, string> = {
    "Likely True": `${officialLine ? officialLine + " " : ""}현재 수집된 정보 기준으로는 이 내용이 사실일 가능성이 높습니다.`,
    "Likely False": `현재 수집된 정보 기준으로는 이 주장의 신빙성이 낮아 보입니다. 원문을 직접 확인해 보세요.`,
    "Mixed Evidence": `${officialLine ? officialLine + " " : ""}한쪽으로 결론 내리기 어려운 상황입니다. 원문을 직접 확인해 보시기 바랍니다.`,
    Unclear: "더 많은 정보를 확인하려면 관련 기사를 직접 검색해 보세요.",
  };

  return [verdictLead[verdict], evidenceSentence, conclusion[verdict]]
    .filter(Boolean)
    .join(" ");
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

  if (params.verdict === "Mixed Evidence") {
    items.push("지지 기사와 반박 기사가 함께 확인됩니다.");
  }

  if (params.hasCurrentUpdateConflict) {
    items.push("일정 변경이나 연기 관련 보도가 있어 최신 상태를 재확인할 필요가 있습니다.");
  }

  if (params.fetchedEvidenceCount < 2) {
    items.push("충분한 자료를 수집하지 못해 결과의 정확도가 낮을 수 있습니다.");
  }

  if (params.contextCount > params.supportCount + params.conflictCount) {
    items.push("직접적인 근거보다 배경 설명 자료가 더 많습니다.");
  }

  if (params.verificationCount === 0 && params.fetchedEvidenceCount >= 2) {
    items.push("공식 발표나 검증 자료가 충분히 수집되지 않았습니다.");
  }

  return items.slice(0, 3);
}

function buildUncertaintySummary(items: string[]): string {
  if (items.length === 0) {
    return "이 결과는 자동 분석이므로 중요한 판단은 원문 기사를 직접 확인해 주세요.";
  }

  return `${items[0]} 추가 정보가 확인되면 결과가 달라질 수 있습니다.`;
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
  const signalEvidenceCount = (input.evidenceSignals ?? []).filter(
    (signal) => signal.stanceToClaim !== "unknown",
  ).length;
  const fetchedEvidenceCount = input.evidenceSnippets.length || signalEvidenceCount;
  const verificationCount = input.sources.filter(
    (source) =>
      source.retrievalBucket === "verification" ||
      categorizeSourceType(source.sourceType) === "official",
  ).length;
  const officialCount = input.sources.filter(
    (source) => categorizeSourceType(source.sourceType) === "official",
  ).length;
  const hasHighTrustSource =
    signalEvidenceCount >= 2 ||
    (verificationCount > 0 &&
      input.sources.some(
        (source) =>
          sourceStances[source.id] !== "unknown" &&
          (source.retrievalBucket === "verification" ||
            categorizeSourceType(source.sourceType) === "official"),
      ));

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
