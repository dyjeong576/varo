import { EvidenceSnippet, Source } from "@prisma/client";
import {
  EvidenceSignal,
  QueryPurpose,
  AnswerCheckType,
  SearchPlan,
  AnswerGeneratedSummary,
} from "../answers.types";

export type AnswerResultVerdict =
  | "Likely True"
  | "Mixed Evidence"
  | "Unclear"
  | "Likely False";
export type AnswerSourceStance = "support" | "conflict" | "context" | "unknown";
export type AnswerConsensusLevel = "high" | "medium" | "low";
export type AnswerSourceCategory =
  | "official"
  | "press"
  | "social"
  | "analysis"
  | "other";

interface ResultAssemblerInput {
  coreCheck: string;
  rawCheck: string;
  sources: Source[];
  evidenceSnippets: EvidenceSnippet[];
  insufficiencyReason: string | null;
  checkType?: AnswerCheckType | null;
  searchPlan?: SearchPlan | null;
  evidenceSignals?: EvidenceSignal[];
  answerSummary?: AnswerGeneratedSummary | null;
}

interface AssembledSourceBreakdown {
  official: number;
  press: number;
  social: number;
  analysis: number;
  other: number;
}

interface AssembledAnswerResult {
  mode: "rule_based_preview" | "direct_answer" | "context_answer_with_news";
  verdict: AnswerResultVerdict | null;
  confidenceScore: number | null;
  consensusLevel: AnswerConsensusLevel | null;
  analysisSummary: string;
  uncertaintySummary: string;
  uncertaintyItems: string[];
  agreementCount: number;
  conflictCount: number;
  contextCount: number;
  sourceBreakdown: AssembledSourceBreakdown;
}

export interface AssembledAnswerResultPayload {
  sourceStances: Record<string, AnswerSourceStance>;
  result: AssembledAnswerResult;
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
const FALLBACK_ANALYSIS_SUMMARY =
  "LLM summary가 아직 저장되지 않아 수집된 출처의 구조 정보만 표시합니다.";
const FALLBACK_UNCERTAINTY_SUMMARY =
  "요약이 없는 기존 결과이므로 중요한 판단은 원문 출처를 직접 확인해 주세요.";
const NO_SEARCH_RESULTS_ANALYSIS_SUMMARY =
  "입력하신 내용과 관련된 뉴스를 찾지 못했습니다.";
const NO_SEARCH_RESULTS_UNCERTAINTY_SUMMARY =
  "검색 결과가 없어 수집된 출처 기준의 해석을 만들 수 없습니다.";

function categorizeSourceType(sourceType: string): AnswerSourceCategory {
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

function mapSignalToSourceStance(signal: EvidenceSignal): AnswerSourceStance {
  if (
    signal.stanceToCheck === "contradicts" ||
    signal.currentAnswerImpact === "weakens" ||
    signal.currentAnswerImpact === "overrides"
  ) {
    return "conflict";
  }

  if (
    signal.stanceToCheck === "supports" ||
    signal.currentAnswerImpact === "strengthens"
  ) {
    return "support";
  }

  if (signal.stanceToCheck === "context" || signal.stanceToCheck === "updates") {
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
): AnswerSourceStance {
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
  sourceStances: Record<string, AnswerSourceStance>,
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
}): AnswerResultVerdict {
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
  verdict: AnswerResultVerdict;
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
  verdict: AnswerResultVerdict,
  supportCount: number,
  hasCurrentUpdateConflict: boolean,
): AnswerConsensusLevel {
  if (hasCurrentUpdateConflict || verdict === "Unclear" || verdict === "Likely False") {
    return "low";
  }

  if (verdict === "Mixed Evidence") {
    return "medium";
  }

  return supportCount >= 2 ? "high" : "medium";
}

export function assembleAnswerResult(
  input: ResultAssemblerInput,
): AssembledAnswerResultPayload {
  const queryPurposesById = buildQueryPurposesById(input.searchPlan);
  const isScheduledEvent = input.checkType === "scheduled_event";
  const signalBySourceId = buildSignalBySourceId(input.evidenceSignals);
  const sourceStances = input.sources.reduce<Record<string, AnswerSourceStance>>(
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
    (signal) => signal.stanceToCheck !== "unknown",
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
  const uncertaintyItems = input.answerSummary?.uncertaintyItems.length
    ? input.answerSummary.uncertaintyItems
    : input.insufficiencyReason
      ? [input.insufficiencyReason]
      : [];
  const hasNoSearchResults = input.sources.length === 0;

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
      analysisSummary:
        input.answerSummary?.analysisSummary ??
        (hasNoSearchResults ? NO_SEARCH_RESULTS_ANALYSIS_SUMMARY : FALLBACK_ANALYSIS_SUMMARY),
      uncertaintySummary:
        input.answerSummary?.uncertaintySummary ??
        (hasNoSearchResults ? NO_SEARCH_RESULTS_UNCERTAINTY_SUMMARY : FALLBACK_UNCERTAINTY_SUMMARY),
      uncertaintyItems,
      agreementCount: supportSources.length,
      conflictCount: conflictSources.length,
      contextCount: contextSources.length,
      sourceBreakdown,
    },
  };
}
