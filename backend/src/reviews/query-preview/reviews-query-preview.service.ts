import { Injectable } from "@nestjs/common";
import { CreateReviewQueryProcessingPreviewDto } from "../dto/create-review-query-processing-preview.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "../dto/review-query-processing-preview-response.dto";
import { ReviewsProvidersService } from "../reviews.providers.service";
import {
  countRelevantSources,
  deduplicateCandidates,
  hasVerificationSource,
  normalizeClaimText,
  selectExtractionCandidates,
} from "../reviews.utils";
import { mapPreviewResponse } from "./reviews-query-preview.mapper";
import { ReviewsQueryPreviewPersistenceService } from "./reviews-query-preview.persistence.service";

const QUERY_COUNT_LIMIT = 1;
const RELEVANCE_LIMIT = 15;
const PRIMARY_EXTRACTION_LIMIT = 5;
const REFERENCE_PROMOTION_LIMIT = 3;

@Injectable()
export class ReviewsQueryPreviewService {
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

    const { claim, reviewJob } =
      await this.persistenceService.createClaimAndReviewJob({
        userId,
        rawClaim: payload.claim,
        normalizedClaim,
      });

    try {
      const userCountryCode =
        await this.persistenceService.resolveUserCountryCode(userId);
      const refinement = await this.providersService.refineQuery(normalizedClaim);
      const generatedQueries = refinement.generatedQueries.slice(0, QUERY_COUNT_LIMIT);
      const domainRegistry = await this.loadSearchDomainRegistry(
        userCountryCode,
        refinement.topicCountryCode,
      );
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

      if (this.shouldRunFallbackSearch(relevanceCandidates)) {
        const fallbackCandidates = await this.providersService.searchFallbackSources(
          generatedQueries,
          domainRegistry,
        );
        const mergedCandidates = deduplicateCandidates([
          ...relevanceCandidates,
          ...fallbackCandidates,
        ]).slice(0, RELEVANCE_LIMIT);

        relevanceCandidates = await this.providersService.applyRelevanceFiltering({
          coreClaim: refinement.coreClaim,
          claimLanguageCode: refinement.claimLanguageCode,
          topicCountryCode: refinement.topicCountryCode,
          topicScope: refinement.topicScope,
          candidates: mergedCandidates,
        });
      }

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
        claimId: claim.id,
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

  private shouldRunFallbackSearch(
    candidates: Parameters<typeof countRelevantSources>[0],
  ): boolean {
    return (
      countRelevantSources(candidates) < PRIMARY_EXTRACTION_LIMIT ||
      !hasVerificationSource(candidates)
    );
  }

  private loadSearchDomainRegistry(
    userCountryCode: string | null,
    topicCountryCode: string | null,
  ) {
    return this.persistenceService.loadSearchDomainRegistry({
      userCountryCode,
      topicCountryCode,
    });
  }
}
