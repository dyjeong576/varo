import type { EvidenceSnippet, Prisma, ReviewJob, Source } from "@prisma/client";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import {
  EvidenceSignal,
  EvidenceSignalImpact,
  EvidenceSignalStance,
  EvidenceSignalTemporalRole,
  EvidenceSignalUpdateType,
  ExtractedSource,
  QueryPurpose,
  QueryArtifact,
  QueryRefinementResult,
  SearchCandidate,
  SearchPlan,
  SourcePoliticalLean,
} from "../reviews.types";
import { hasVerificationSource } from "../reviews.utils";
import { ReviewQueryProcessingPreviewResponseDto } from "../dto/review-query-processing-preview-response.dto";
import { ReviewPreviewSummaryResponseDto } from "../dto/review-preview-summary-response.dto";
import { assembleReviewResult } from "./review-result-assembler";

interface ReviewClaimRecord {
  id: string;
  rawText: string;
  normalizedText: string;
}

interface StoredReviewPreviewRecord {
  id: string;
  clientRequestId: string | null;
  status: string;
  currentStage: string;
  searchedSourceCount: number;
  lastErrorCode: string | null;
  createdAt: Date;
  claim: ReviewClaimRecord;
  queryRefinement: Prisma.JsonValue | null;
  handoffPayload: Prisma.JsonValue | null;
  sources: Source[];
  evidenceSnippets: EvidenceSnippet[];
}

interface StoredReviewPreviewSummaryRecord {
  id: string;
  clientRequestId: string | null;
  status: string;
  currentStage: string;
  lastErrorCode: string | null;
  createdAt: Date;
  claim: Pick<ReviewClaimRecord, "rawText">;
  sources: Array<Pick<Source, "fetchStatus">>;
}

interface QueryRefinementPayload {
  claimLanguageCode: string;
  languageCode: string;
  coreClaim: string;
  normalizedClaim: string;
  claimType: string;
  verificationGoal: string;
  searchPlan: SearchPlan | null;
  generatedQueries: QueryArtifact[];
  searchRoute?: string;
  searchRouteReason?: string;
  searchClaim?: string;
  searchQueries?: QueryArtifact[];
  topicScope: string;
  topicCountryCode: string | null;
  countryDetectionReason: string;
  isKoreaRelated: boolean;
  koreaRelevanceReason: string;
  searchProvider?: string;
}

interface HandoffPayload {
  coreClaim: string;
  sourceIds: string[];
  snippetIds: string[];
  insufficiencyReason: string | null;
  evidenceSignals: EvidenceSignal[];
}

const QUERY_PURPOSES: QueryPurpose[] = [
  "claim_specific",
  "current_state",
  "primary_source",
  "contradiction_or_update",
];
const REVIEW_CLAIM_TYPES = [
  "scheduled_event",
  "current_status",
  "statistic",
  "quote",
  "policy",
  "corporate_action",
  "incident",
  "general_fact",
];
const SEARCH_ROUTES = ["korean_news", "global_news", "unsupported"];
const EVIDENCE_SIGNAL_STANCES: EvidenceSignalStance[] = [
  "supports",
  "contradicts",
  "updates",
  "context",
  "unknown",
];
const EVIDENCE_SIGNAL_TEMPORAL_ROLES: EvidenceSignalTemporalRole[] = [
  "past_plan",
  "current_status",
  "latest_update",
  "official_statement",
  "background",
];
const EVIDENCE_SIGNAL_UPDATE_TYPES: EvidenceSignalUpdateType[] = [
  "delay",
  "cancellation",
  "correction",
  "confirmation",
  "none",
];
const EVIDENCE_SIGNAL_IMPACTS: EvidenceSignalImpact[] = [
  "strengthens",
  "weakens",
  "overrides",
  "neutral",
];

export function buildSourceCreateInputs(
  reviewJobId: string,
  candidates: SearchCandidate[],
  extractedSources: ExtractedSource[],
): Prisma.SourceUncheckedCreateInput[] {
  const extractedSourceMap = new Map(
    extractedSources.map((item) => [item.canonicalUrl, item]),
  );

  return candidates.map((candidate) => {
    const extracted = extractedSourceMap.get(candidate.canonicalUrl);

    return {
      reviewJobId,
      sourceProvider: candidate.sourceProvider,
      sourceType: candidate.sourceType,
      publisherName: candidate.publisherName,
      publishedAt: candidate.publishedAt ? new Date(candidate.publishedAt) : null,
      canonicalUrl: candidate.canonicalUrl,
      originalUrl: candidate.originalUrl,
      rawTitle: candidate.rawTitle,
      rawSnippet: candidate.rawSnippet,
      normalizedHash: candidate.normalizedHash,
      fetchStatus: extracted ? "fetched" : "pending",
      contentText: extracted?.contentText ?? null,
      isDuplicate: false,
      duplicateGroupKey: null,
      originQueryIds: candidate.originQueryIds as Prisma.InputJsonValue,
      relevanceTier: candidate.relevanceTier ?? "discard",
      relevanceReason: candidate.relevanceReason ?? null,
      sourceCountryCode: candidate.sourceCountryCode,
      retrievalBucket: candidate.retrievalBucket,
    };
  });
}

export function buildEvidenceSnippetCreateInputs(
  reviewJobId: string,
  sources: Source[],
  extractedSources: ExtractedSource[],
): Prisma.EvidenceSnippetUncheckedCreateInput[] {
  const extractedSourceMap = new Map(
    extractedSources.map((item) => [item.canonicalUrl, item]),
  );

  return sources
    .filter((source) => source.fetchStatus === "fetched" && source.contentText)
    .map((source) => {
      const extracted = extractedSourceMap.get(source.canonicalUrl);

      return {
        reviewJobId,
        sourceId: source.id,
        snippetText:
          extracted?.snippetText ??
          source.rawSnippet ??
          source.contentText ??
          source.rawTitle,
        stance: "neutral",
        startOffset: null,
        endOffset: null,
      };
    });
}

export function buildInsufficiencyReason(
  candidates: SearchCandidate[],
  primaryExtractionLimit: number,
): string | null {
  const primaryCount = candidates.filter((c) => c.relevanceTier === "primary").length;

  if (primaryCount === 0) {
    return "관련 출처를 충분히 수집하지 못했습니다.";
  }

  if (!hasVerificationSource(candidates)) {
    return "공식/검증 성격 source가 부족해 뉴스 검색 결과 중심으로 handoff 됩니다.";
  }

  if (primaryCount < primaryExtractionLimit) {
    return "primary source가 충분하지 않아 reference 일부가 제한적으로 승격되었습니다.";
  }

  return null;
}

export function buildHandoffSourceIds(sources: Source[]): string[] {
  return sources
    .filter(
      (source) =>
        source.relevanceTier === "primary" || source.relevanceTier === "reference",
    )
    .map((source) => source.id);
}

export function buildQueryRefinementPayload(
  refinement: QueryRefinementResult,
  generatedQueries: QueryArtifact[],
): Prisma.InputJsonValue {
  const searchRoute =
    refinement.searchRoute ??
    (refinement.isKoreaRelated ? "korean_news" : "unsupported");
  const searchQueries = refinement.searchQueries ?? generatedQueries;
  const searchProvider = buildSearchProvider(searchRoute);

  return {
    claimLanguageCode: refinement.claimLanguageCode,
    languageCode: refinement.claimLanguageCode,
    coreClaim: refinement.coreClaim,
    normalizedClaim: refinement.normalizedClaim,
    claimType: refinement.claimType,
    verificationGoal: refinement.verificationGoal,
    searchPlan: {
      normalizedClaim: refinement.searchPlan.normalizedClaim,
      claimType: refinement.searchPlan.claimType,
      verificationGoal: refinement.searchPlan.verificationGoal,
      searchRoute: refinement.searchPlan.searchRoute,
      queries: refinement.searchPlan.queries.map((query) => ({
        id: query.id,
        purpose: query.purpose,
        query: query.query,
        priority: query.priority,
      })),
    },
    generatedQueries: generatedQueries.map(serializeQueryArtifact),
    topicScope: refinement.topicScope,
    topicCountryCode: refinement.topicCountryCode,
    countryDetectionReason: refinement.countryDetectionReason,
    isKoreaRelated: refinement.isKoreaRelated,
    koreaRelevanceReason: refinement.koreaRelevanceReason,
    searchRoute,
    searchRouteReason:
      refinement.searchRouteReason ?? "검색 route 판정 이유가 기록되지 않았습니다.",
    searchClaim: refinement.searchClaim ?? refinement.coreClaim,
    searchQueries: searchQueries.map(serializeQueryArtifact),
    searchProvider,
  } as Prisma.InputJsonValue;
}

function serializeQueryArtifact(query: QueryArtifact): Record<string, unknown> {
  return {
    id: query.id,
    text: query.text,
    rank: query.rank,
    ...(query.purpose ? { purpose: query.purpose } : {}),
  };
}

export function buildHandoffPayload(
  coreClaim: string,
  sourceIds: string[],
  snippetIds: string[],
  insufficiencyReason: string | null,
  evidenceSignals: EvidenceSignal[] = [],
  sourcePoliticalLeans: Record<string, SourcePoliticalLean> = {},
): Prisma.InputJsonValue {
  return {
    coreClaim,
    sourceIds,
    snippetIds,
    insufficiencyReason,
    evidenceSignals,
    sourcePoliticalLeans,
  } as unknown as Prisma.InputJsonValue;
}

export function buildCompletedReviewJobUpdate(
  reviewJobId: string,
  searchedSourceCount: number,
  processedSourceCount: number,
  queryRefinement: Prisma.InputJsonValue,
  handoffPayload: Prisma.InputJsonValue,
  hasEvidenceSnippets: boolean,
): {
  where: { id: string };
  data: Prisma.ReviewJobUpdateInput;
} {
  return {
    where: { id: reviewJobId },
    data: {
      status: "partial",
      currentStage: "handoff_ready",
      searchedSourceCount,
      processedSourceCount,
      queryRefinement,
      handoffPayload,
      lastErrorCode: hasEvidenceSnippets ? null : APP_ERROR_CODES.REVIEW_PARTIAL,
    },
  };
}

export function parseOriginQueryIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function buildEvidenceSummary(sourceId: string, sources: Source[]): string | null {
  return sources.find((source) => source.id === sourceId)?.relevanceReason ?? null;
}

function buildSearchProvider(searchRoute: string): string | null {
  if (searchRoute === "korean_news") {
    return "naver-search";
  }

  if (searchRoute === "global_news") {
    return "tavily-search";
  }

  return null;
}

export function mapPreviewResponse(params: {
  reviewJob: Pick<ReviewJob, "id" | "clientRequestId">;
  claim: Pick<ReviewClaimRecord, "id" | "rawText">;
  createdAt: Date;
  normalizedClaim: string;
  refinement: QueryRefinementResult;
  generatedQueries: QueryArtifact[];
  sources: Source[];
  evidenceSnippets: EvidenceSnippet[];
  selectedSourceCount: number;
  discardedSourceCount: number;
  handoffSourceIds: string[];
  insufficiencyReason: string | null;
  evidenceSignals?: EvidenceSignal[];
}): ReviewQueryProcessingPreviewResponseDto {
  const assembledResult = assembleReviewResult({
    coreClaim: params.refinement.coreClaim,
    rawClaim: params.claim.rawText,
    sources: params.sources,
    evidenceSnippets: params.evidenceSnippets,
    insufficiencyReason: params.insufficiencyReason,
    searchPlan: params.refinement.searchPlan,
    evidenceSignals: params.evidenceSignals,
  });

  return {
    reviewId: params.reviewJob.id,
    clientRequestId: params.reviewJob.clientRequestId,
    claimId: params.claim.id,
    rawClaim: params.claim.rawText,
    createdAt: params.createdAt.toISOString(),
    isKoreaRelated: params.refinement.isKoreaRelated,
    koreaRelevanceReason: params.refinement.koreaRelevanceReason,
    status: "partial",
    currentStage: "handoff_ready",
    normalizedClaim: params.normalizedClaim,
    claimLanguageCode: params.refinement.claimLanguageCode,
    languageCode: params.refinement.claimLanguageCode,
    coreClaim: params.refinement.coreClaim,
    topicScope: params.refinement.topicScope,
    topicCountryCode: params.refinement.topicCountryCode,
    countryDetectionReason: params.refinement.countryDetectionReason,
    generatedQueries: params.generatedQueries,
    sources: params.sources.map((source) => ({
      id: source.id,
      sourceType: source.sourceType,
      publisherName: source.publisherName,
      canonicalUrl: source.canonicalUrl,
      originalUrl: source.originalUrl,
      publishedAt: source.publishedAt?.toISOString() ?? null,
      rawTitle: source.rawTitle,
      rawSnippet: source.rawSnippet,
      relevanceTier: source.relevanceTier ?? "discard",
      relevanceReason: source.relevanceReason,
      originQueryIds: parseOriginQueryIds(source.originQueryIds),
      sourceCountryCode: source.sourceCountryCode,
      retrievalBucket: source.retrievalBucket,
      domainRegistryMatched: false,
      stance: assembledResult.sourceStances[source.id] ?? "unknown",
    })),
    evidenceSnippets: params.evidenceSnippets.map((snippet) => ({
      id: snippet.id,
      sourceId: snippet.sourceId,
      snippetText: snippet.snippetText,
      evidenceSummary: buildEvidenceSummary(snippet.sourceId, params.sources),
    })),
    searchedSourceCount: params.sources.length,
    selectedSourceCount: params.selectedSourceCount,
    discardedSourceCount: params.discardedSourceCount,
    handoff: {
      coreClaim: params.refinement.coreClaim,
      sourceIds: params.handoffSourceIds,
      snippetIds: params.evidenceSnippets.map((snippet) => snippet.id),
      insufficiencyReason: params.insufficiencyReason,
    },
    result: assembledResult.result,
  };
}

export function mapOutOfScopePreviewResponse(params: {
  reviewJob: Pick<ReviewJob, "id" | "clientRequestId">;
  claim: Pick<ReviewClaimRecord, "id" | "rawText">;
  createdAt: Date;
  normalizedClaim: string;
  refinement: QueryRefinementResult;
  generatedQueries: QueryArtifact[];
  insufficiencyReason: string | null;
}): ReviewQueryProcessingPreviewResponseDto {
  return {
    reviewId: params.reviewJob.id,
    clientRequestId: params.reviewJob.clientRequestId,
    claimId: params.claim.id,
    rawClaim: params.claim.rawText,
    createdAt: params.createdAt.toISOString(),
    isKoreaRelated: params.refinement.isKoreaRelated,
    koreaRelevanceReason: params.refinement.koreaRelevanceReason,
    status: "out_of_scope",
    currentStage: "scope_checked",
    normalizedClaim: params.normalizedClaim,
    claimLanguageCode: params.refinement.claimLanguageCode,
    languageCode: params.refinement.claimLanguageCode,
    coreClaim: params.refinement.coreClaim,
    topicScope: params.refinement.topicScope,
    topicCountryCode: params.refinement.topicCountryCode,
    countryDetectionReason: params.refinement.countryDetectionReason,
    generatedQueries: params.generatedQueries,
    sources: [],
    evidenceSnippets: [],
    searchedSourceCount: 0,
    selectedSourceCount: 0,
    discardedSourceCount: 0,
    handoff: {
      coreClaim: params.refinement.coreClaim,
      sourceIds: [],
      snippetIds: [],
      insufficiencyReason: params.insufficiencyReason,
    },
    result: null,
  };
}

function parseJsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function parseNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseGeneratedQueries(value: unknown): QueryArtifact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const id = parseString(record.id);
    const text = parseString(record.text);
    const rank =
      typeof record.rank === "number" && Number.isFinite(record.rank)
        ? record.rank
        : 0;
    const purpose = QUERY_PURPOSES.includes(record.purpose as QueryPurpose)
      ? (record.purpose as QueryPurpose)
      : undefined;

    if (!id || !text || rank <= 0) {
      return [];
    }

    return [{ id, text, rank, purpose }];
  });
}

function parseSearchPlan(value: unknown): SearchPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const claimType = parseString(record.claimType);
  const searchRoute = parseString(record.searchRoute);
  const queries = Array.isArray(record.queries)
    ? record.queries.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return [];
        }

        const queryRecord = item as Record<string, unknown>;
        const id = parseString(queryRecord.id);
        const purpose = queryRecord.purpose as QueryPurpose;
        const query = parseString(queryRecord.query);
        const priority =
          typeof queryRecord.priority === "number" && Number.isFinite(queryRecord.priority)
            ? queryRecord.priority
            : 0;

        if (!id || !QUERY_PURPOSES.includes(purpose) || !query || priority <= 0) {
          return [];
        }

        return [{ id, purpose, query, priority }];
      })
    : [];

  if (
    !REVIEW_CLAIM_TYPES.includes(claimType) ||
    !SEARCH_ROUTES.includes(searchRoute) ||
    queries.length === 0
  ) {
    return null;
  }

  return {
    normalizedClaim: parseString(record.normalizedClaim),
    claimType: claimType as SearchPlan["claimType"],
    verificationGoal: parseString(record.verificationGoal),
    searchRoute: searchRoute as SearchPlan["searchRoute"],
    queries,
  };
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseEvidenceSignals(value: unknown): EvidenceSignal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const sourceId = parseString(record.sourceId);
    const stanceToClaim = record.stanceToClaim as EvidenceSignalStance;
    const temporalRole = record.temporalRole as EvidenceSignalTemporalRole;
    const updateType = record.updateType as EvidenceSignalUpdateType;
    const currentAnswerImpact = record.currentAnswerImpact as EvidenceSignalImpact;

    if (
      !sourceId ||
      !EVIDENCE_SIGNAL_STANCES.includes(stanceToClaim) ||
      !EVIDENCE_SIGNAL_TEMPORAL_ROLES.includes(temporalRole) ||
      !EVIDENCE_SIGNAL_UPDATE_TYPES.includes(updateType) ||
      !EVIDENCE_SIGNAL_IMPACTS.includes(currentAnswerImpact)
    ) {
      return [];
    }

    return [
      {
        sourceId,
        snippetId: parseNullableString(record.snippetId),
        stanceToClaim,
        temporalRole,
        updateType,
        currentAnswerImpact,
        reason: parseString(record.reason, "signal 분류 이유가 기록되지 않았습니다."),
      },
    ];
  });
}

function parseQueryRefinementPayload(
  value: Prisma.JsonValue | null,
  normalizedClaim: string,
): QueryRefinementPayload {
  const payload = parseJsonRecord(value);

  if (!payload) {
    return {
      claimLanguageCode: "unknown",
      languageCode: "unknown",
      coreClaim: normalizedClaim,
      normalizedClaim,
      claimType: "general_fact",
      verificationGoal: "검증 목표 생성 전입니다.",
      searchPlan: null,
      generatedQueries: [],
      searchRoute: "unsupported",
      searchRouteReason: "검색 route 판정 전입니다.",
      searchClaim: normalizedClaim,
      searchQueries: [],
      topicScope: "unknown",
      topicCountryCode: null,
      countryDetectionReason: "주제 국가 판정 전입니다.",
      isKoreaRelated: true,
      koreaRelevanceReason: "한국 관련성 판정 전입니다.",
    };
  }

  const claimLanguageCode = parseString(payload.claimLanguageCode, "unknown");
  const isKoreaRelated = parseBoolean(payload.isKoreaRelated, true);
  const searchRoute = parseString(
    payload.searchRoute,
    isKoreaRelated ? "korean_news" : "unsupported",
  );
  const generatedQueries = parseGeneratedQueries(payload.generatedQueries);
  const searchQueries = parseGeneratedQueries(payload.searchQueries);

  return {
    claimLanguageCode,
    languageCode: parseString(payload.languageCode, claimLanguageCode),
    coreClaim: parseString(payload.coreClaim, normalizedClaim),
    normalizedClaim: parseString(payload.normalizedClaim, normalizedClaim),
    claimType: parseString(payload.claimType, "general_fact"),
    verificationGoal: parseString(
      payload.verificationGoal,
      "검증 목표가 기록되지 않았습니다.",
    ),
    searchPlan: parseSearchPlan(payload.searchPlan),
    generatedQueries,
    searchRoute,
    searchRouteReason: parseString(
      payload.searchRouteReason,
      "검색 route 판정 전입니다.",
    ),
    searchClaim: parseString(
      payload.searchClaim,
      parseString(payload.coreClaim, normalizedClaim),
    ),
    searchQueries: searchQueries.length > 0 ? searchQueries : generatedQueries,
    topicScope: parseString(payload.topicScope, "unknown"),
    topicCountryCode: parseNullableString(payload.topicCountryCode),
    countryDetectionReason: parseString(
      payload.countryDetectionReason,
      "주제 국가 판정 전입니다.",
    ),
    isKoreaRelated,
    koreaRelevanceReason: parseString(
      payload.koreaRelevanceReason,
      "한국 관련성 판정 전입니다.",
    ),
  };
}

function parseHandoffPayload(
  value: Prisma.JsonValue | null,
  fallbackCoreClaim: string,
  evidenceSnippets: EvidenceSnippet[],
): HandoffPayload {
  const payload = parseJsonRecord(value);

  if (!payload) {
    return {
      coreClaim: fallbackCoreClaim,
      sourceIds: evidenceSnippets.map((snippet) => snippet.sourceId),
      snippetIds: evidenceSnippets.map((snippet) => snippet.id),
      insufficiencyReason: null,
      evidenceSignals: [],
    };
  }

  return {
    coreClaim: parseString(payload.coreClaim, fallbackCoreClaim),
    sourceIds: parseStringArray(payload.sourceIds),
    snippetIds: parseStringArray(payload.snippetIds),
    insufficiencyReason: parseNullableString(payload.insufficiencyReason),
    evidenceSignals: parseEvidenceSignals(payload.evidenceSignals),
  };
}

export function mapStoredPreviewSummary(
  reviewJob: StoredReviewPreviewSummaryRecord,
): ReviewPreviewSummaryResponseDto {
  return {
    reviewId: reviewJob.id,
    clientRequestId: reviewJob.clientRequestId,
    rawClaim: reviewJob.claim.rawText,
    status: reviewJob.status,
    currentStage: reviewJob.currentStage,
    createdAt: reviewJob.createdAt.toISOString(),
    selectedSourceCount: reviewJob.sources.filter(
      (source) => source.fetchStatus === "fetched",
    ).length,
    lastErrorCode: reviewJob.lastErrorCode,
  };
}

export function mapStoredPreviewResponse(
  reviewJob: StoredReviewPreviewRecord,
): ReviewQueryProcessingPreviewResponseDto {
  const refinement = parseQueryRefinementPayload(
    reviewJob.queryRefinement,
    reviewJob.claim.normalizedText,
  );
  const handoff = parseHandoffPayload(
    reviewJob.handoffPayload,
    refinement.coreClaim,
    reviewJob.evidenceSnippets,
  );
  const assembledResult = assembleReviewResult({
    coreClaim: refinement.coreClaim,
    rawClaim: reviewJob.claim.rawText,
    sources: reviewJob.sources,
    evidenceSnippets: reviewJob.evidenceSnippets,
    insufficiencyReason: handoff.insufficiencyReason,
    searchPlan: refinement.searchPlan,
    evidenceSignals: handoff.evidenceSignals,
  });
  const result =
    reviewJob.status === "out_of_scope" ? null : assembledResult.result;

  return {
    reviewId: reviewJob.id,
    clientRequestId: reviewJob.clientRequestId,
    claimId: reviewJob.claim.id,
    rawClaim: reviewJob.claim.rawText,
    createdAt: reviewJob.createdAt.toISOString(),
    isKoreaRelated: refinement.isKoreaRelated,
    koreaRelevanceReason: refinement.koreaRelevanceReason,
    status: reviewJob.status,
    currentStage: reviewJob.currentStage,
    normalizedClaim: reviewJob.claim.normalizedText,
    claimLanguageCode: refinement.claimLanguageCode,
    languageCode: refinement.languageCode,
    coreClaim: refinement.coreClaim,
    topicScope: refinement.topicScope,
    topicCountryCode: refinement.topicCountryCode,
    countryDetectionReason: refinement.countryDetectionReason,
    generatedQueries: refinement.generatedQueries,
    sources: reviewJob.sources.map((source) => ({
      id: source.id,
      sourceType: source.sourceType,
      publisherName: source.publisherName,
      canonicalUrl: source.canonicalUrl,
      originalUrl: source.originalUrl,
      publishedAt: source.publishedAt?.toISOString() ?? null,
      rawTitle: source.rawTitle,
      rawSnippet: source.rawSnippet,
      relevanceTier: source.relevanceTier ?? "discard",
      relevanceReason: source.relevanceReason,
      originQueryIds: parseOriginQueryIds(source.originQueryIds),
      sourceCountryCode: source.sourceCountryCode,
      retrievalBucket: source.retrievalBucket,
      domainRegistryMatched: false,
      stance: assembledResult.sourceStances[source.id] ?? "unknown",
    })),
    evidenceSnippets: reviewJob.evidenceSnippets.map((snippet) => ({
      id: snippet.id,
      sourceId: snippet.sourceId,
      snippetText: snippet.snippetText,
      evidenceSummary: buildEvidenceSummary(snippet.sourceId, reviewJob.sources),
    })),
    searchedSourceCount:
      reviewJob.searchedSourceCount > 0
        ? reviewJob.searchedSourceCount
        : reviewJob.sources.length,
    selectedSourceCount: reviewJob.sources.filter(
      (source) => source.fetchStatus === "fetched",
    ).length,
    discardedSourceCount: reviewJob.sources.filter(
      (source) => source.relevanceTier === "discard",
    ).length,
    handoff: {
      coreClaim: handoff.coreClaim,
      sourceIds: handoff.sourceIds,
      snippetIds: handoff.snippetIds,
      insufficiencyReason: handoff.insufficiencyReason,
    },
    result,
  };
}
