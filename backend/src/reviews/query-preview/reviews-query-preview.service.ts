import { Injectable, Logger } from "@nestjs/common";
import { CreateReviewQueryProcessingPreviewDto } from "../dto/create-review-query-processing-preview.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "../dto/review-query-processing-preview-response.dto";
import { ReviewsProvidersService } from "../reviews.providers.service";
import {
  deduplicateCandidates,
  normalizeClaimText,
  selectExtractionCandidates,
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

const QUERY_COUNT_LIMIT = 1;
const RELEVANCE_LIMIT = 15;
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
      const userCountryCode =
        await this.persistenceService.resolveUserCountryCode(userId);
      const refinement = await this.providersService.refineQuery(normalizedClaim);
      const generatedQueries = refinement.generatedQueries.slice(0, QUERY_COUNT_LIMIT);

      if (!refinement.isKoreaRelated) {
        const persistedOutOfScope =
          await this.persistenceService.persistOutOfScopeReview({
            userId,
            reviewJob,
            refinement,
            generatedQueries,
            userCountryCode,
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

      const domainRegistry = await this.loadSearchDomainRegistry();
      const initialCandidates = await this.providersService.searchSources({
        queries: generatedQueries,
        coreClaim: refinement.coreClaim,
        claimLanguageCode: refinement.claimLanguageCode,
        userCountryCode,
        topicCountryCode: refinement.topicCountryCode,
        topicScope: refinement.topicScope,
        domainRegistry,
      });
      let relevanceCandidates = await this.providersService.applyRelevanceFiltering({
        coreClaim: refinement.coreClaim,
        claimLanguageCode: refinement.claimLanguageCode,
        topicCountryCode: refinement.topicCountryCode,
        topicScope: refinement.topicScope,
        candidates: deduplicateCandidates(initialCandidates).slice(0, RELEVANCE_LIMIT),
      });

      const extractionTargets = selectExtractionCandidates(
        relevanceCandidates,
        PRIMARY_EXTRACTION_LIMIT,
        REFERENCE_PROMOTION_LIMIT,
      );
      const extractedSources = extractionTargets.length
        ? await this.providersService.extractContent(extractionTargets)
        : [];
      const persistedArtifacts =
        await this.persistenceService.persistQueryPreviewResult({
          userId,
          reviewJob,
          refinement,
          generatedQueries,
          userCountryCode,
          relevanceCandidates,
          extractionTargets,
          extractedSources,
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
        selectedSourceCount: extractionTargets.length,
        discardedSourceCount: persistedArtifacts.discardedSourceCount,
        handoffSourceIds: persistedArtifacts.handoffSourceIds,
        insufficiencyReason: persistedArtifacts.insufficiencyReason,
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

  private loadSearchDomainRegistry() {
    return this.persistenceService.loadSearchDomainRegistry();
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
}
