import { Injectable, Logger } from "@nestjs/common";
import { ReviewJob, Source } from "@prisma/client";
import { AppException } from "../../common/exceptions/app-exception";
import { CreateReviewQueryProcessingPreviewDto } from "../dto/create-review-query-processing-preview.dto";
import { ReviewPreviewSummaryResponseDto } from "../dto/review-preview-summary-response.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "../dto/review-query-processing-preview-response.dto";
import { ReviewsProvidersService } from "../reviews.providers.service";
import {
  QueryArtifact,
  QueryRefinementResult,
  SearchCandidate,
} from "../reviews.types";
import {
  deduplicateCandidates,
  getKoreanSearchDomainRegistry,
  normalizeClaimText,
} from "../reviews.utils";
import {
  mapOutOfScopePreviewResponse, mapPreviewResponse, mapSearchPreviewResponse,
  mapStoredPreviewResponse,
  mapStoredPreviewSummary
} from "./reviews-query-preview.mapper";
import { ReviewsQueryPreviewPersistenceService } from "./reviews-query-preview.persistence.service";

const RELEVANCE_LIMIT = 8;
const PRIMARY_EXTRACTION_LIMIT = 5;
const REFERENCE_PROMOTION_LIMIT = 3;

@Injectable()
export class ReviewsQueryPreviewService {
  private readonly logger = new Logger(ReviewsQueryPreviewService.name);

  constructor(
    private readonly persistenceService: ReviewsQueryPreviewPersistenceService,
    private readonly providersService: ReviewsProvidersService,
  ) {}

  async createQueryProcessingPreview(
    userId: string,
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    const normalizedClaim = normalizeClaimText(payload.claim);
    this.persistenceService.validateNormalizedClaim(normalizedClaim);

    const existingReview =
      payload.clientRequestId &&
      (await this.persistenceService.findQueryProcessingPreviewByClientRequestId(
        userId,
        payload.clientRequestId,
      ));

    if (
      existingReview &&
      existingReview.status !== "searching" &&
      existingReview.status !== "failed"
    ) {
      return mapStoredPreviewResponse(existingReview);
    }

    const { claim, reviewJob } = existingReview
      ? {
          claim: {
            id: existingReview.claim.id,
            rawText: existingReview.claim.rawText,
          },
          reviewJob: {
            id: existingReview.id,
            createdAt: existingReview.createdAt,
            clientRequestId: existingReview.clientRequestId,
          },
        }
      : await this.persistenceService.createClaimAndReviewJob({
          userId,
          rawClaim: payload.claim,
          normalizedClaim,
          clientRequestId: payload.clientRequestId,
        });

    if (existingReview) {
      await this.persistenceService.resetQueryProcessingPreview(reviewJob.id);
    }

    try {
      const startedAt = Date.now();
      const refinementStartedAt = Date.now();
      const refinement = await this.providersService.refineQuery(normalizedClaim);
      this.logStageDuration("query_refinement", refinementStartedAt, reviewJob.id);
      const generatedQueries = refinement.generatedQueries;
      const searchRoute =
        refinement.searchRoute === "news" ? "news" : "unsupported";
      const sourceQueries =
        refinement.searchPlan?.queries?.length
          ? refinement.searchPlan.queries.map((query) => ({
              id: query.id,
              text: query.query,
              rank: query.priority,
              purpose: query.purpose,
            }))
          : refinement.generatedQueries;

      if (searchRoute === "unsupported") {
        const persistedOutOfScope =
          await this.persistenceService.persistOutOfScopeReview({
            userId,
            reviewJob,
            refinement,
            generatedQueries,
          });

        return mapOutOfScopePreviewResponse({
          reviewJob,
          claim,
          createdAt: reviewJob.createdAt,
          normalizedClaim,
          refinement,
          generatedQueries,
          insufficiencyReason: persistedOutOfScope.insufficiencyReason,
        });
      }

      const sourceSearchStartedAt = Date.now();
      const initialCandidates = await this.providersService.searchSources({
        searchRoute,
        queries: sourceQueries,
        coreClaim: refinement.coreClaim,
        domainRegistry: getKoreanSearchDomainRegistry(),
      });
      const relevanceStartedAt = Date.now();
      const relevanceSignalResult =
        await this.providersService.classifyRelevanceAndEvidenceSignals({
          coreClaim: refinement.coreClaim,
          searchRoute,
          searchPlan: refinement.searchPlan,
          candidates: this.selectClassificationCandidates(initialCandidates, sourceQueries),
        });
      this.logStageDuration(
        "relevance_and_signal_classification",
        relevanceStartedAt,
        reviewJob.id,
      );
      const relevanceCandidates = relevanceSignalResult.relevanceCandidates;
      const evidenceSignals = relevanceSignalResult.evidenceSignals.slice(
        0,
        PRIMARY_EXTRACTION_LIMIT + REFERENCE_PROMOTION_LIMIT,
      );
      const persistStartedAt = Date.now();
      const persistedArtifacts =
        await this.persistenceService.persistQueryPreviewResult({
          userId,
          reviewJob,
          refinement,
          generatedQueries,
          relevanceCandidates,
          evidenceSignals,
          primaryExtractionLimit: PRIMARY_EXTRACTION_LIMIT,
        });

      return mapPreviewResponse({
        reviewJob,
        claim,
        createdAt: reviewJob.createdAt,
        normalizedClaim,
        refinement,
        generatedQueries,
        sources: persistedArtifacts.createdSources,
        evidenceSnippets: persistedArtifacts.evidenceSnippets,
        selectedSourceCount: evidenceSignals.length,
        discardedSourceCount: persistedArtifacts.discardedSourceCount,
        handoffSourceIds: persistedArtifacts.handoffSourceIds,
        insufficiencyReason: persistedArtifacts.insufficiencyReason,
        evidenceSignals: persistedArtifacts.evidenceSignals,
      });
    } catch (error) {
      this.logger.error(
        this.buildPreviewFailureLogMessage({
          userId,
          reviewJobId: reviewJob.id,
          claimId: claim.id,
          clientRequestId: reviewJob.clientRequestId ?? payload.clientRequestId ?? null,
          error,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      await this.persistenceService.markReviewJobFailed(reviewJob.id, error);
      throw error;
    }
  }

  async createQueryProcessingPreviewAsync(
    userId: string,
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    const normalizedClaim = normalizeClaimText(payload.claim);
    this.persistenceService.validateNormalizedClaim(normalizedClaim);

    const existingReview =
      payload.clientRequestId &&
      (await this.persistenceService.findQueryProcessingPreviewByClientRequestId(
        userId,
        payload.clientRequestId,
      ));

    if (existingReview && existingReview.status !== "failed") {
      return mapStoredPreviewResponse(existingReview);
    }

    const { claim, reviewJob } = existingReview
      ? {
          claim: {
            id: existingReview.claim.id,
            rawText: existingReview.claim.rawText,
          },
          reviewJob: {
            id: existingReview.id,
            createdAt: existingReview.createdAt,
            clientRequestId: existingReview.clientRequestId,
          },
        }
      : await this.persistenceService.createClaimAndReviewJob({
          userId,
          rawClaim: payload.claim,
          normalizedClaim,
          clientRequestId: payload.clientRequestId,
        });

    if (existingReview) {
      await this.persistenceService.resetQueryProcessingPreview(reviewJob.id);
    }

    try {
      const refinementStartedAt = Date.now();
      const refinement = await this.providersService.refineQuery(normalizedClaim);
      this.logStageDuration("query_refinement", refinementStartedAt, reviewJob.id);
      const generatedQueries = refinement.generatedQueries;
      const searchRoute =
        refinement.searchRoute === "news" ? "news" : "unsupported";
      const sourceQueries =
        refinement.searchPlan?.queries?.length
          ? refinement.searchPlan.queries.map((query) => ({
              id: query.id,
              text: query.query,
              rank: query.priority,
              purpose: query.purpose,
            }))
          : refinement.generatedQueries;

      if (searchRoute === "unsupported") {
        const persistedOutOfScope =
          await this.persistenceService.persistOutOfScopeReview({
            userId,
            reviewJob,
            refinement,
            generatedQueries,
          });

        return mapOutOfScopePreviewResponse({
          reviewJob,
          claim,
          createdAt: reviewJob.createdAt,
          normalizedClaim,
          refinement,
          generatedQueries,
          insufficiencyReason: persistedOutOfScope.insufficiencyReason,
        });
      }

      const initialCandidates = await this.providersService.searchSources({
        searchRoute,
        queries: sourceQueries,
        coreClaim: refinement.coreClaim,
        domainRegistry: getKoreanSearchDomainRegistry(),
      });
      const classificationCandidates = this.selectClassificationCandidates(
        initialCandidates,
        sourceQueries,
      );
      const previewCandidates = classificationCandidates.map((candidate) => ({
        ...candidate,
        relevanceTier: candidate.relevanceTier ?? "reference",
        relevanceReason:
          candidate.relevanceReason ??
          "검색 결과 후보입니다. 근거 신호 분류가 진행 중입니다.",
      }));
      const createdSources =
        await this.persistenceService.persistSearchPreviewSources({
          reviewJob,
          refinement,
          generatedQueries,
          candidates: previewCandidates,
        });

      void this.completeAsyncQueryProcessingPreview({
        userId,
        reviewJob,
        refinement,
        generatedQueries,
        candidates: classificationCandidates,
        existingSources: createdSources,
      });

      return mapSearchPreviewResponse({
        reviewJob,
        claim,
        createdAt: reviewJob.createdAt,
        normalizedClaim,
        refinement,
        generatedQueries,
        sources: createdSources,
      });
    } catch (error) {
      this.logger.error(
        this.buildPreviewFailureLogMessage({
          userId,
          reviewJobId: reviewJob.id,
          claimId: claim.id,
          clientRequestId: reviewJob.clientRequestId ?? payload.clientRequestId ?? null,
          error,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      await this.persistenceService.markReviewJobFailed(reviewJob.id, error);
      throw error;
    }
  }

  async createTestQueryProcessingPreview(
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    const previewUser = await this.persistenceService.ensurePreviewUser();

    return this.createQueryProcessingPreview(previewUser.id, payload);
  }

  private async completeAsyncQueryProcessingPreview(params: {
    userId: string;
    reviewJob: Pick<ReviewJob, "id">;
    refinement: QueryRefinementResult;
    generatedQueries: QueryArtifact[];
    candidates: SearchCandidate[];
    existingSources: Source[];
  }): Promise<void> {
    try {
      const relevanceStartedAt = Date.now();
      const relevanceSignalResult =
        await this.providersService.classifyRelevanceAndEvidenceSignals({
          coreClaim: params.refinement.coreClaim,
          searchRoute: "news",
          searchPlan: params.refinement.searchPlan,
          candidates: params.candidates,
        });
      this.logStageDuration(
        "relevance_and_signal_classification",
        relevanceStartedAt,
        params.reviewJob.id,
      );
      const evidenceSignals = relevanceSignalResult.evidenceSignals.slice(
        0,
        PRIMARY_EXTRACTION_LIMIT + REFERENCE_PROMOTION_LIMIT,
      );

      await this.persistenceService.persistQueryPreviewResult({
        userId: params.userId,
        reviewJob: params.reviewJob,
        refinement: params.refinement,
        generatedQueries: params.generatedQueries,
        relevanceCandidates: relevanceSignalResult.relevanceCandidates,
        evidenceSignals,
        primaryExtractionLimit: PRIMARY_EXTRACTION_LIMIT,
        existingSources: params.existingSources,
      });
    } catch (error) {
      this.logger.error(
        this.buildPreviewFailureLogMessage({
          userId: params.userId,
          reviewJobId: params.reviewJob.id,
          claimId: "unknown",
          clientRequestId: null,
          error,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      await this.persistenceService.markReviewJobFailed(params.reviewJob.id, error);
    }
  }

  private selectClassificationCandidates(
    candidates: SearchCandidate[],
    sourceQueries: QueryArtifact[],
  ): SearchCandidate[] {
    const dedupedCandidates = deduplicateCandidates(candidates);
    const sourceQueryIds = sourceQueries.map((query) => query.id);
    const selectedCandidates: SearchCandidate[] = [];
    const selectedCandidateUrls = new Set<string>();

    while (selectedCandidates.length < RELEVANCE_LIMIT) {
      let addedInRound = false;

      for (const queryId of sourceQueryIds) {
        if (selectedCandidates.length >= RELEVANCE_LIMIT) {
          break;
        }

        const candidate = dedupedCandidates.find(
          (dedupedCandidate) =>
            !selectedCandidateUrls.has(dedupedCandidate.canonicalUrl) &&
            dedupedCandidate.originQueryIds.includes(queryId),
        );

        if (!candidate) {
          continue;
        }

        selectedCandidates.push(candidate);
        selectedCandidateUrls.add(candidate.canonicalUrl);
        addedInRound = true;
      }

      if (!addedInRound) {
        break;
      }
    }

    if (selectedCandidates.length < RELEVANCE_LIMIT) {
      for (const candidate of dedupedCandidates) {
        if (selectedCandidates.length >= RELEVANCE_LIMIT) {
          break;
        }

        if (!selectedCandidateUrls.has(candidate.canonicalUrl)) {
          selectedCandidates.push(candidate);
          selectedCandidateUrls.add(candidate.canonicalUrl);
        }
      }
    }

    return selectedCandidates;
  }

  async listQueryProcessingPreviews(
    userId: string,
  ): Promise<ReviewPreviewSummaryResponseDto[]> {
    const reviewJobs =
      await this.persistenceService.listRecentQueryProcessingPreviews(userId);

    return reviewJobs.map(mapStoredPreviewSummary);
  }

  async getQueryProcessingPreview(
    userId: string,
    reviewId: string,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    const reviewJob = await this.persistenceService.getQueryProcessingPreview(
      userId,
      reviewId,
    );

    return mapStoredPreviewResponse(reviewJob);
  }

  async deleteQueryProcessingPreview(
    userId: string,
    reviewId: string,
  ): Promise<void> {
    await this.persistenceService.deleteQueryProcessingPreview(userId, reviewId);
  }

  async recordReviewReopen(
    userId: string,
    reviewId: string,
  ): Promise<void> {
    const reviewJob = await this.persistenceService.ensureReopenableReview(reviewId);

    await this.persistenceService.recordHistoryEntry({
      userId,
      reviewJobId: reviewJob.id,
      entryType: "reopened",
    });
  }

  private buildPreviewFailureLogMessage(params: {
    userId: string;
    reviewJobId: string;
    claimId: string;
    clientRequestId: string | null;
    error: unknown;
  }): string {
    const errorCode = params.error instanceof AppException
      ? params.error.code
      : params.error instanceof Error
        ? params.error.name
        : "UNKNOWN_ERROR";
    const errorMessage = params.error instanceof Error
      ? params.error.message
      : "Unknown non-error failure";

    return [
      "review query processing preview failed",
      `userId=${params.userId}`,
      `reviewJobId=${params.reviewJobId}`,
      `claimId=${params.claimId}`,
      `clientRequestId=${params.clientRequestId ?? "none"}`,
      `errorCode=${errorCode}`,
      `errorMessage=${errorMessage}`,
    ].join(" ");
  }

  private logStageDuration(
    stage: string,
    startedAt: number,
    reviewJobId: string,
  ): void {
    this.logger.log(
      `review preview stage ${stage} completed in ${Date.now() - startedAt}ms; reviewJobId=${reviewJobId}`,
    );
  }
}
