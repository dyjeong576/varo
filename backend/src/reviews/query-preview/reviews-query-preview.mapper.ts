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
  reviewJob: Pick<ReviewJob, "id">;
  claimId: string;
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
  return {
    reviewId: params.reviewJob.id,
    claimId: params.claimId,
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
      rawTitle: source.rawTitle,
      rawSnippet: source.rawSnippet,
      relevanceTier: source.relevanceTier ?? "discard",
      relevanceReason: source.relevanceReason,
      originQueryIds: parseOriginQueryIds(source.originQueryIds),
      sourceCountryCode: source.sourceCountryCode,
      retrievalBucket: source.retrievalBucket,
      domainRegistryMatched: Boolean(source.domainRegistryId),
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
  };
}
