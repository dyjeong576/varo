import type { EvidenceSnippet, Prisma, ReviewJob, Source } from "@prisma/client";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import {
  ExtractedSource,
  QueryArtifact,
  QueryRefinementResult,
  SearchCandidate,
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
  generatedQueries: QueryArtifact[];
  topicScope: string;
  topicCountryCode: string | null;
  countryDetectionReason: string;
  isKoreaRelated: boolean;
  koreaRelevanceReason: string;
}

interface HandoffPayload {
  coreClaim: string;
  sourceIds: string[];
  snippetIds: string[];
  insufficiencyReason: string | null;
}

export function buildSourceCreateInputs(
  reviewJobId: string,
  candidates: SearchCandidate[],
  extractedSources: ExtractedSource[],
): Prisma.SourceUncheckedCreateInput[] {
  return candidates.map((candidate) => {
    const extracted = extractedSources.find(
      (item) => item.canonicalUrl === candidate.canonicalUrl,
    );

    return {
      reviewJobId,
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
      domainRegistryId: candidate.domainRegistryId,
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
  evidenceSnippetCount: number,
  extractionTargetCount: number,
  candidates: SearchCandidate[],
  primaryExtractionLimit: number,
): string | null {
  if (evidenceSnippetCount === 0) {
    return "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.";
  }

  if (!hasVerificationSource(candidates)) {
    return "verification bucket source가 부족해 친숙한 국내 기사 중심으로 handoff 됩니다.";
  }

  if (extractionTargetCount < primaryExtractionLimit) {
    return "primary source가 충분하지 않아 reference 일부가 제한적으로 승격되었습니다.";
  }

  return null;
}

export function buildHandoffSourceIds(
  sources: Source[],
  evidenceSnippets: EvidenceSnippet[],
): string[] {
  return sources
    .filter((source) =>
      evidenceSnippets.some((snippet) => snippet.sourceId === source.id),
    )
    .map((source) => source.id);
}

export function buildQueryRefinementPayload(
  refinement: QueryRefinementResult,
  generatedQueries: QueryArtifact[],
  userCountryCode: string | null,
): Prisma.InputJsonValue {
  return {
    claimLanguageCode: refinement.claimLanguageCode,
    languageCode: refinement.claimLanguageCode,
    coreClaim: refinement.coreClaim,
    generatedQueries: generatedQueries.map((query) => ({
      id: query.id,
      text: query.text,
      rank: query.rank,
    })),
    topicScope: refinement.topicScope,
    topicCountryCode: refinement.topicCountryCode,
    countryDetectionReason: refinement.countryDetectionReason,
    isKoreaRelated: refinement.isKoreaRelated,
    koreaRelevanceReason: refinement.koreaRelevanceReason,
    userCountryCode,
  } as Prisma.InputJsonValue;
}

export function buildHandoffPayload(
  coreClaim: string,
  sourceIds: string[],
  snippetIds: string[],
  insufficiencyReason: string | null,
): Prisma.InputJsonValue {
  return {
    coreClaim,
    sourceIds,
    snippetIds,
    insufficiencyReason,
  } as Prisma.InputJsonValue;
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
}): ReviewQueryProcessingPreviewResponseDto {
  const assembledResult = assembleReviewResult({
    coreClaim: params.refinement.coreClaim,
    rawClaim: params.claim.rawText,
    sources: params.sources,
    evidenceSnippets: params.evidenceSnippets,
    insufficiencyReason: params.insufficiencyReason,
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
      domainRegistryMatched: Boolean(source.domainRegistryId),
      stance: assembledResult.sourceStances[source.id] ?? "unknown",
    })),
    evidenceSnippets: params.evidenceSnippets.map((snippet) => ({
      id: snippet.id,
      sourceId: snippet.sourceId,
      snippetText: snippet.snippetText,
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
    isKoreaRelated: false,
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

    if (!id || !text || rank <= 0) {
      return [];
    }

    return [{ id, text, rank }];
  });
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
      generatedQueries: [],
      topicScope: "unknown",
      topicCountryCode: null,
      countryDetectionReason: "주제 국가 판정 전입니다.",
      isKoreaRelated: true,
      koreaRelevanceReason: "한국 관련성 판정 전입니다.",
    };
  }

  const claimLanguageCode = parseString(payload.claimLanguageCode, "unknown");

  return {
    claimLanguageCode,
    languageCode: parseString(payload.languageCode, claimLanguageCode),
    coreClaim: parseString(payload.coreClaim, normalizedClaim),
    generatedQueries: parseGeneratedQueries(payload.generatedQueries),
    topicScope: parseString(payload.topicScope, "unknown"),
    topicCountryCode: parseNullableString(payload.topicCountryCode),
    countryDetectionReason: parseString(
      payload.countryDetectionReason,
      "주제 국가 판정 전입니다.",
    ),
    isKoreaRelated: parseBoolean(payload.isKoreaRelated, true),
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
    };
  }

  return {
    coreClaim: parseString(payload.coreClaim, fallbackCoreClaim),
    sourceIds: parseStringArray(payload.sourceIds),
    snippetIds: parseStringArray(payload.snippetIds),
    insufficiencyReason: parseNullableString(payload.insufficiencyReason),
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
      domainRegistryMatched: Boolean(source.domainRegistryId),
      stance: assembledResult.sourceStances[source.id] ?? "unknown",
    })),
    evidenceSnippets: reviewJob.evidenceSnippets.map((snippet) => ({
      id: snippet.id,
      sourceId: snippet.sourceId,
      snippetText: snippet.snippetText,
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
    handoff,
    result,
  };
}
