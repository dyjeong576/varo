import type { EvidenceSnippet, Prisma, AnswerJob, Source } from "@prisma/client";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import {
  EvidenceSignal,
  EvidenceSignalImpact,
  EvidenceSignalStance,
  EvidenceSignalTemporalRole,
  EvidenceSignalUpdateType,
  AnswerGeneratedSummary,
  ExtractedSource,
  QueryPurpose,
  QueryArtifact,
  QueryRefinementResult,
  SearchCandidate,
  SearchPlan,
  SourcePoliticalLean,
} from "../answers.types";
import { hasVerificationSource } from "../answers.utils";
import { AnswerQueryProcessingPreviewResponseDto } from "../dto/answer-query-processing-preview-response.dto";
import { AnswerPreviewSummaryResponseDto } from "../dto/answer-preview-summary-response.dto";
import { assembleAnswerResult } from "./answer-result-assembler";

interface AnswerCheckRecord {
  id: string;
  rawText: string;
  normalizedText: string;
}

interface StoredAnswerPreviewRecord {
  id: string;
  clientRequestId: string | null;
  status: string;
  currentStage: string;
  searchedSourceCount: number;
  lastErrorCode: string | null;
  createdAt: Date;
  check: AnswerCheckRecord;
  queryRefinement: Prisma.JsonValue | null;
  handoffPayload: Prisma.JsonValue | null;
  sources: Source[];
  evidenceSnippets: EvidenceSnippet[];
}

interface StoredAnswerPreviewSummaryRecord {
  id: string;
  clientRequestId: string | null;
  status: string;
  currentStage: string;
  lastErrorCode: string | null;
  createdAt: Date;
  check: Pick<AnswerCheckRecord, "rawText">;
  sources: Array<Pick<Source, "fetchStatus">>;
}

interface QueryRefinementPayload {
  coreCheck: string;
  normalizedCheck: string;
  checkType: string;
  answerType: string;
  searchPlan: SearchPlan | null;
  generatedQueries: QueryArtifact[];
  searchRoute?: string;
  searchRouteReason?: string;
  searchProvider?: string;
}

interface HandoffPayload {
  coreCheck: string;
  sourceIds: string[];
  snippetIds: string[];
  insufficiencyReason: string | null;
  evidenceSignals: EvidenceSignal[];
  answerSummary: AnswerGeneratedSummary | null;
}

const QUERY_PURPOSES: QueryPurpose[] = [
  "check_specific",
  "current_state",
  "primary_source",
  "contradiction_or_update",
];
const ANSWER_CHECK_TYPES = [
  "scheduled_event",
  "current_status",
  "statistic",
  "quote",
  "policy",
  "corporate_action",
  "incident",
  "general_fact",
];
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
  answerJobId: string,
  candidates: SearchCandidate[],
  extractedSources: ExtractedSource[],
): Prisma.SourceUncheckedCreateInput[] {
  const extractedSourceMap = new Map(
    extractedSources.map((item) => [item.canonicalUrl, item]),
  );

  return candidates.map((candidate) => {
    const extracted = extractedSourceMap.get(candidate.canonicalUrl);

    return {
      answerJobId,
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
      retrievalBucket: candidate.retrievalBucket,
    };
  });
}

export function buildEvidenceSnippetCreateInputs(
  answerJobId: string,
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
        answerJobId,
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
    refinement.searchRoute ?? "unsupported";
  const searchProvider = buildSearchProvider(searchRoute);

  return {
    coreCheck: refinement.coreCheck,
    normalizedCheck: refinement.normalizedCheck,
    checkType: refinement.checkType,
    answerType: refinement.answerType,
    searchPlan: {
      queries: refinement.searchPlan.queries.map((query) => ({
        id: query.id,
        purpose: query.purpose,
        query: query.query,
        priority: query.priority,
      })),
    },
    generatedQueries: generatedQueries.map(serializeQueryArtifact),
    searchRoute,
    searchRouteReason:
      refinement.searchRouteReason ?? "검색 route 판정 이유가 기록되지 않았습니다.",
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
  coreCheck: string,
  sourceIds: string[],
  snippetIds: string[],
  insufficiencyReason: string | null,
  evidenceSignals: EvidenceSignal[] = [],
  sourcePoliticalLeans: Record<string, SourcePoliticalLean> = {},
  answerSummary: AnswerGeneratedSummary | null = null,
): Prisma.InputJsonValue {
  return {
    coreCheck,
    sourceIds,
    snippetIds,
    insufficiencyReason,
    evidenceSignals,
    sourcePoliticalLeans,
    answerSummary,
  } as unknown as Prisma.InputJsonValue;
}

export function buildCompletedAnswerJobUpdate(
  answerJobId: string,
  searchedSourceCount: number,
  processedSourceCount: number,
  queryRefinement: Prisma.InputJsonValue,
  handoffPayload: Prisma.InputJsonValue,
  hasEvidenceSnippets: boolean,
): {
  where: { id: string };
  data: Prisma.AnswerJobUpdateInput;
} {
  return {
    where: { id: answerJobId },
    data: {
      status: "partial",
      currentStage: "handoff_ready",
      searchedSourceCount,
      processedSourceCount,
      queryRefinement,
      handoffPayload,
      lastErrorCode: hasEvidenceSnippets ? null : APP_ERROR_CODES.ANSWER_PARTIAL,
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
  if (searchRoute === "supported" || searchRoute === "news") {
    return "naver-search";
  }

  return null;
}

export function mapPreviewResponse(params: {
  answerJob: Pick<AnswerJob, "id" | "clientRequestId">;
  check: Pick<AnswerCheckRecord, "id" | "rawText">;
  createdAt: Date;
  normalizedCheck: string;
  refinement: QueryRefinementResult;
  generatedQueries: QueryArtifact[];
  sources: Source[];
  evidenceSnippets: EvidenceSnippet[];
  selectedSourceCount: number;
  discardedSourceCount: number;
  handoffSourceIds: string[];
  insufficiencyReason: string | null;
  evidenceSignals?: EvidenceSignal[];
  answerSummary?: AnswerGeneratedSummary | null;
}): AnswerQueryProcessingPreviewResponseDto {
  const assembledResult = assembleAnswerResult({
    coreCheck: params.refinement.coreCheck,
    rawCheck: params.check.rawText,
    sources: params.sources,
    evidenceSnippets: params.evidenceSnippets,
    insufficiencyReason: params.insufficiencyReason,
    checkType: params.refinement.checkType,
    searchPlan: params.refinement.searchPlan,
    evidenceSignals: params.evidenceSignals,
    answerSummary: params.answerSummary,
  });

  return {
    answerId: params.answerJob.id,
    clientRequestId: params.answerJob.clientRequestId,
    checkId: params.check.id,
    rawCheck: params.check.rawText,
    createdAt: params.createdAt.toISOString(),
    status: "partial",
    currentStage: "handoff_ready",
    normalizedCheck: params.normalizedCheck,
    coreCheck: params.refinement.coreCheck,
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
      coreCheck: params.refinement.coreCheck,
      sourceIds: params.handoffSourceIds,
      snippetIds: params.evidenceSnippets.map((snippet) => snippet.id),
      insufficiencyReason: params.insufficiencyReason,
    },
    result: assembledResult.result,
  };
}

export function mapOutOfScopePreviewResponse(params: {
  answerJob: Pick<AnswerJob, "id" | "clientRequestId">;
  check: Pick<AnswerCheckRecord, "id" | "rawText">;
  createdAt: Date;
  normalizedCheck: string;
  refinement: QueryRefinementResult;
  generatedQueries: QueryArtifact[];
  insufficiencyReason: string | null;
}): AnswerQueryProcessingPreviewResponseDto {
  return {
    answerId: params.answerJob.id,
    clientRequestId: params.answerJob.clientRequestId,
    checkId: params.check.id,
    rawCheck: params.check.rawText,
    createdAt: params.createdAt.toISOString(),
    status: "out_of_scope",
    currentStage: "scope_checked",
    normalizedCheck: params.normalizedCheck,
    coreCheck: params.refinement.coreCheck,
    generatedQueries: params.generatedQueries,
    sources: [],
    evidenceSnippets: [],
    searchedSourceCount: 0,
    selectedSourceCount: 0,
    discardedSourceCount: 0,
    handoff: {
      coreCheck: params.refinement.coreCheck,
      sourceIds: [],
      snippetIds: [],
      insufficiencyReason: params.insufficiencyReason,
    },
    result: null,
  };
}

export function mapSearchPreviewResponse(params: {
  answerJob: Pick<AnswerJob, "id" | "clientRequestId">;
  check: Pick<AnswerCheckRecord, "id" | "rawText">;
  createdAt: Date;
  normalizedCheck: string;
  refinement: QueryRefinementResult;
  generatedQueries: QueryArtifact[];
  sources: Source[];
}): AnswerQueryProcessingPreviewResponseDto {
  return {
    answerId: params.answerJob.id,
    clientRequestId: params.answerJob.clientRequestId,
    checkId: params.check.id,
    rawCheck: params.check.rawText,
    createdAt: params.createdAt.toISOString(),
    status: "searching",
    currentStage: "relevance_and_signal_classification",
    normalizedCheck: params.normalizedCheck,
    coreCheck: params.refinement.coreCheck,
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
      relevanceTier: source.relevanceTier ?? "reference",
      relevanceReason: source.relevanceReason,
      originQueryIds: parseOriginQueryIds(source.originQueryIds),
      retrievalBucket: source.retrievalBucket,
      domainRegistryMatched: false,
      stance: "unknown",
    })),
    evidenceSnippets: [],
    searchedSourceCount: params.sources.length,
    selectedSourceCount: 0,
    discardedSourceCount: 0,
    handoff: {
      coreCheck: params.refinement.coreCheck,
      sourceIds: [],
      snippetIds: [],
      insufficiencyReason: null,
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
    queries.length === 0
  ) {
    return null;
  }

  return {
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
    const stanceToCheck = record.stanceToCheck as EvidenceSignalStance;
    const temporalRole = record.temporalRole as EvidenceSignalTemporalRole;
    const updateType = record.updateType as EvidenceSignalUpdateType;
    const currentAnswerImpact = record.currentAnswerImpact as EvidenceSignalImpact;

    if (
      !sourceId ||
      !EVIDENCE_SIGNAL_STANCES.includes(stanceToCheck) ||
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
        stanceToCheck,
        temporalRole,
        updateType,
        currentAnswerImpact,
        reason: parseString(record.reason, "signal 분류 이유가 기록되지 않았습니다."),
      },
    ];
  });
}

function parseAnswerSummary(value: unknown): AnswerGeneratedSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const analysisSummary = parseString(record.analysisSummary);
  const uncertaintySummary = parseString(record.uncertaintySummary);
  const uncertaintyItems = parseStringArray(record.uncertaintyItems).slice(0, 3);

  if (!analysisSummary || !uncertaintySummary) {
    return null;
  }

  return {
    analysisSummary,
    uncertaintySummary,
    uncertaintyItems,
  };
}

function parseQueryRefinementPayload(
  value: Prisma.JsonValue | null,
  normalizedCheck: string,
): QueryRefinementPayload {
  const payload = parseJsonRecord(value);

  if (!payload) {
    return {
      coreCheck: normalizedCheck,
      normalizedCheck,
      checkType: "general_fact",
      answerType: "descriptive_answer",
      searchPlan: null,
      generatedQueries: [],
      searchRoute: "unsupported",
      searchRouteReason: "검색 route 판정 전입니다.",
    };
  }

  const rawSearchRoute = parseString(payload.searchRoute, "unsupported");
  const searchRoute = rawSearchRoute === "news" ? "supported" : rawSearchRoute;
  const generatedQueries = parseGeneratedQueries(payload.generatedQueries);

  return {
    coreCheck: parseString(payload.coreCheck, normalizedCheck),
    normalizedCheck: parseString(payload.normalizedCheck, normalizedCheck),
    checkType: parseString(payload.checkType, "general_fact"),
    answerType: parseString(payload.answerType, "descriptive_answer"),
    searchPlan: parseSearchPlan(payload.searchPlan),
    generatedQueries,
    searchRoute,
    searchRouteReason: parseString(
      payload.searchRouteReason,
      "검색 route 판정 전입니다.",
    ),
  };
}

function parseHandoffPayload(
  value: Prisma.JsonValue | null,
  fallbackCoreCheck: string,
  evidenceSnippets: EvidenceSnippet[],
): HandoffPayload {
  const payload = parseJsonRecord(value);

  if (!payload) {
    return {
      coreCheck: fallbackCoreCheck,
      sourceIds: evidenceSnippets.map((snippet) => snippet.sourceId),
      snippetIds: evidenceSnippets.map((snippet) => snippet.id),
      insufficiencyReason: null,
      evidenceSignals: [],
      answerSummary: null,
    };
  }

  return {
    coreCheck: parseString(payload.coreCheck, fallbackCoreCheck),
    sourceIds: parseStringArray(payload.sourceIds),
    snippetIds: parseStringArray(payload.snippetIds),
    insufficiencyReason: parseNullableString(payload.insufficiencyReason),
    evidenceSignals: parseEvidenceSignals(payload.evidenceSignals),
    answerSummary: parseAnswerSummary(payload.answerSummary),
  };
}

export function mapStoredPreviewSummary(
  answerJob: StoredAnswerPreviewSummaryRecord,
): AnswerPreviewSummaryResponseDto {
  return {
    answerId: answerJob.id,
    clientRequestId: answerJob.clientRequestId,
    rawCheck: answerJob.check.rawText,
    status: answerJob.status,
    currentStage: answerJob.currentStage,
    createdAt: answerJob.createdAt.toISOString(),
    selectedSourceCount: answerJob.sources.filter(
      (source) => source.fetchStatus === "fetched",
    ).length,
    lastErrorCode: answerJob.lastErrorCode,
  };
}

export function mapStoredPreviewResponse(
  answerJob: StoredAnswerPreviewRecord,
): AnswerQueryProcessingPreviewResponseDto {
  const refinement = parseQueryRefinementPayload(
    answerJob.queryRefinement,
    answerJob.check.normalizedText,
  );
  const handoff = parseHandoffPayload(
    answerJob.handoffPayload,
    refinement.coreCheck,
    answerJob.evidenceSnippets,
  );
  const assembledResult = assembleAnswerResult({
    coreCheck: refinement.coreCheck,
    rawCheck: answerJob.check.rawText,
    sources: answerJob.sources,
    evidenceSnippets: answerJob.evidenceSnippets,
    insufficiencyReason: handoff.insufficiencyReason,
    checkType: refinement.checkType as QueryRefinementResult["checkType"],
    searchPlan: refinement.searchPlan,
    evidenceSignals: handoff.evidenceSignals,
    answerSummary: handoff.answerSummary,
  });
  const result =
    answerJob.status === "out_of_scope" || answerJob.status === "searching"
      ? null
      : assembledResult.result;

  return {
    answerId: answerJob.id,
    clientRequestId: answerJob.clientRequestId,
    checkId: answerJob.check.id,
    rawCheck: answerJob.check.rawText,
    createdAt: answerJob.createdAt.toISOString(),
    status: answerJob.status,
    currentStage: answerJob.currentStage,
    normalizedCheck: answerJob.check.normalizedText,
    coreCheck: refinement.coreCheck,
    generatedQueries: refinement.generatedQueries,
    sources: answerJob.sources.map((source) => ({
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
      retrievalBucket: source.retrievalBucket,
      domainRegistryMatched: false,
      stance: assembledResult.sourceStances[source.id] ?? "unknown",
    })),
    evidenceSnippets: answerJob.evidenceSnippets.map((snippet) => ({
      id: snippet.id,
      sourceId: snippet.sourceId,
      snippetText: snippet.snippetText,
      evidenceSummary: buildEvidenceSummary(snippet.sourceId, answerJob.sources),
    })),
    searchedSourceCount:
      answerJob.searchedSourceCount > 0
        ? answerJob.searchedSourceCount
        : answerJob.sources.length,
    selectedSourceCount: handoff.sourceIds.length,
    discardedSourceCount: answerJob.sources.filter(
      (source) => source.relevanceTier === "discard",
    ).length,
    handoff: {
      coreCheck: handoff.coreCheck,
      sourceIds: handoff.sourceIds,
      snippetIds: handoff.snippetIds,
      insufficiencyReason: handoff.insufficiencyReason,
    },
    result,
  };
}
