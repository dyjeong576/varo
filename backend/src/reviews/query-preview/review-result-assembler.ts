import { EvidenceSnippet, Source } from "@prisma/client";

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

function summarizeSourceCategory(category: ReviewSourceCategory): string {
  switch (category) {
    case "official":
      return "공식 출처";
    case "press":
      return "언론 보도";
    case "social":
      return "소셜 원문";
    case "analysis":
      return "해설형 출처";
    default:
      return "기타 출처";
  }
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

function determineSourceStance(
  source: Source,
  evidenceSnippets: EvidenceSnippet[],
): ReviewSourceStance {
  if (source.relevanceTier === "discard") {
    return "unknown";
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

  return clamp(Math.round(score), 35, 98);
}

function buildConsensusLevel(
  verdict: ReviewResultVerdict,
  supportCount: number,
  conflictCount: number,
): ReviewConsensusLevel {
  if (verdict === "Unclear") {
    return "low";
  }

  if (verdict === "Mixed Evidence") {
    return "medium";
  }

  return supportCount >= 2 || conflictCount >= 2 ? "high" : "medium";
}

function pickDominantCategory(sourceBreakdown: AssembledSourceBreakdown): ReviewSourceCategory {
  const entries = Object.entries(sourceBreakdown) as Array<
    [ReviewSourceCategory, number]
  >;
  const [category] = entries.sort((left, right) => right[1] - left[1])[0] ?? ["other", 0];
  return category;
}

function buildAnalysisSummary(params: {
  coreClaim: string;
  verdict: ReviewResultVerdict;
  supportCount: number;
  conflictCount: number;
  contextCount: number;
  verificationCount: number;
  sourceBreakdown: AssembledSourceBreakdown;
}): string {
  const {
    coreClaim,
    verdict,
    supportCount,
    conflictCount,
    contextCount,
    verificationCount,
    sourceBreakdown,
  } = params;

  const verdictLead: Record<ReviewResultVerdict, string> = {
    "Likely True": `수집된 출처 기준으로는 "${coreClaim}"를 지지하는 근거가 더 우세합니다.`,
    "Likely False": `수집된 출처 기준으로는 "${coreClaim}"와 충돌하는 근거가 더 우세합니다.`,
    "Mixed Evidence": `수집된 출처 기준으로는 "${coreClaim}"에 대해 지지와 충돌 신호가 함께 확인됩니다.`,
    Unclear: `현재 확보된 출처만으로는 "${coreClaim}"를 한 방향으로 해석하기 어렵습니다.`,
  };

  const dominantCategory = summarizeSourceCategory(
    pickDominantCategory(sourceBreakdown),
  );
  const trustSentence =
    verificationCount > 0
      ? "verification 또는 공식 성격의 source가 포함되어 있어 현재 단계 기준 검토 밀도는 비교적 높습니다."
      : "아직 verification 또는 공식 성격의 source 비중이 높지 않아 해석 강도는 제한적입니다.";

  return [
    verdictLead[verdict],
    `${dominantCategory} 중심으로 지지 근거 ${supportCount}건, 충돌 근거 ${conflictCount}건, 맥락 보완 근거 ${contextCount}건이 정리됐습니다.`,
    trustSentence,
    "이 결과는 interpretation 생성 전, 현재 저장된 source와 evidence snippet만으로 계산한 임시 분석입니다.",
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
  const sourceStances = input.sources.reduce<Record<string, ReviewSourceStance>>(
    (acc, source) => {
      acc[source.id] = determineSourceStance(source, input.evidenceSnippets);
      return acc;
    },
    {},
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
      }),
      consensusLevel: buildConsensusLevel(
        verdict,
        supportSources.length,
        conflictSources.length,
      ),
      analysisSummary: buildAnalysisSummary({
        coreClaim: input.coreClaim || input.rawClaim,
        verdict,
        supportCount: supportSources.length,
        conflictCount: conflictSources.length,
        contextCount: contextSources.length,
        verificationCount,
        sourceBreakdown,
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
