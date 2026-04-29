import { Injectable, Logger } from "@nestjs/common";
import { CreateReviewQueryProcessingPreviewDto } from "../dto/create-review-query-processing-preview.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "../dto/review-query-processing-preview-response.dto";
import { ReviewsProvidersService } from "../reviews.providers.service";
import {
  deduplicateCandidates,
  getKoreanSearchDomainRegistry,
  normalizeClaimText,
} from "../reviews.utils";
import { mapPreviewResponse } from "./reviews-query-preview.mapper";
import {
  mapOutOfScopePreviewResponse,
  mapStoredPreviewResponse,
  mapStoredPreviewSummary,
} from "./reviews-query-preview.mapper";
import { ReviewsQueryPreviewPersistenceService } from "./reviews-query-preview.persistence.service";
import { ReviewPreviewSummaryResponseDto } from "../dto/review-preview-summary-response.dto";
import { AppException } from "../../common/exceptions/app-exception";

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
        refinement.searchRoute === "korean_news" ? "korean_news" : "unsupported";
      const searchQueries =
        refinement.searchPlan?.queries?.length
          ? refinement.searchPlan.queries.map((query) => ({
              id: query.id,
              text: query.query,
              rank: query.priority,
              purpose: query.purpose,
            }))
          : (refinement.searchQueries ?? refinement.generatedQueries);

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
        queries: searchQueries,
        coreClaim: refinement.coreClaim,
        claimLanguageCode: refinement.claimLanguageCode,
        topicCountryCode: refinement.topicCountryCode,
        domainRegistry: getKoreanSearchDomainRegistry(),
      });
      const relevanceStartedAt = Date.now();
      const relevanceSignalResult =
        await this.providersService.classifyRelevanceAndEvidenceSignals({
          coreClaim: refinement.coreClaim,
          claimLanguageCode: refinement.claimLanguageCode,
          searchRoute,
          topicCountryCode: refinement.topicCountryCode,
          searchPlan: refinement.searchPlan,
          candidates: deduplicateCandidates(initialCandidates).slice(0, RELEVANCE_LIMIT),
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

  async createTestQueryProcessingPreview(
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    const previewUser = await this.persistenceService.ensurePreviewUser();

    return this.createQueryProcessingPreview(previewUser.id, payload);
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
