import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewQueryProcessingPreviewDto } from "./dto/create-review-query-processing-preview.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "./dto/review-query-processing-preview-response.dto";
import { ReviewsProvidersService } from "./reviews.providers.service";
import {
  DomainRegistryEntry,
  SearchCandidate,
  countRelevantSources,
  deduplicateCandidates,
  hasVerificationSource,
  normalizeClaimText,
  normalizeCountryCode,
  selectExtractionCandidates,
} from "./reviews.utils";

const QUERY_COUNT_LIMIT = 1;
const RELEVANCE_LIMIT = 15;
const PRIMARY_EXTRACTION_LIMIT = 5;
const REFERENCE_PROMOTION_LIMIT = 3;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providersService: ReviewsProvidersService,
  ) {}

  async createQueryProcessingPreview(
    userId: string,
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    const normalizedClaim = normalizeClaimText(payload.claim);

    if (!normalizedClaim) {
      throw new AppException(
        APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
        "검토할 claim을 입력해 주세요.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const claim = await this.prisma.claim.create({
      data: {
        rawText: payload.claim,
        normalizedText: normalizedClaim,
      },
    });

    const reviewJob = await this.prisma.reviewJob.create({
      data: {
        userId,
        claimId: claim.id,
        status: "searching",
        currentStage: "query_refinement",
      },
    });

    try {
      const userCountryCode = await this.resolveUserCountryCode(userId);
      const refinement = await this.providersService.refineQuery(normalizedClaim);
      const generatedQueries = refinement.generatedQueries.slice(0, QUERY_COUNT_LIMIT);
      const domainRegistry = await this.loadDomainRegistry();
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

      const sourceCreateInputs: Prisma.SourceUncheckedCreateInput[] =
        relevanceCandidates.map((candidate) => {
          const extracted = extractedSources.find(
            (item) => item.canonicalUrl === candidate.canonicalUrl,
          );

          return {
            reviewJobId: reviewJob.id,
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

      const createdSources = await Promise.all(
        sourceCreateInputs.map((data) => this.prisma.source.create({ data })),
      );

      const extractedSourceMap = new Map(
        extractedSources.map((item) => [item.canonicalUrl, item]),
      );

      const evidenceSnippets = await Promise.all(
        createdSources
          .filter((source) => source.fetchStatus === "fetched" && source.contentText)
          .map((source) => {
            const extracted = extractedSourceMap.get(source.canonicalUrl);

            return this.prisma.evidenceSnippet.create({
              data: {
                reviewJobId: reviewJob.id,
                sourceId: source.id,
                snippetText:
                  extracted?.snippetText ??
                  source.rawSnippet ??
                  source.contentText ??
                  source.rawTitle,
                stance: "neutral",
                startOffset: null,
                endOffset: null,
              },
            });
          }),
      );

      const discardedSourceCount = createdSources.filter(
        (source) => source.relevanceTier === "discard",
      ).length;
      const insufficiencyReason = this.buildInsufficiencyReason(
        evidenceSnippets.length,
        extractionTargets.length,
        relevanceCandidates,
      );
      const handoffSourceIds = createdSources
        .filter((source) =>
          evidenceSnippets.some((snippet) => snippet.sourceId === source.id),
        )
        .map((source) => source.id);

      const queryRefinementPayload = {
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

      const handoffPayload = {
        coreClaim: refinement.coreClaim,
        sourceIds: handoffSourceIds,
        snippetIds: evidenceSnippets.map((snippet) => snippet.id),
        insufficiencyReason,
      } as Prisma.InputJsonValue;

      await this.prisma.reviewJob.update({
        where: { id: reviewJob.id },
        data: {
          status: "partial",
          currentStage: "handoff_ready",
          searchedSourceCount: createdSources.length,
          processedSourceCount: evidenceSnippets.length,
          queryRefinement: queryRefinementPayload,
          handoffPayload,
          lastErrorCode:
            evidenceSnippets.length === 0 ? APP_ERROR_CODES.REVIEW_PARTIAL : null,
        },
      });

      return {
        reviewId: reviewJob.id,
        claimId: claim.id,
        status: "partial",
        currentStage: "handoff_ready",
        normalizedClaim,
        claimLanguageCode: refinement.claimLanguageCode,
        languageCode: refinement.claimLanguageCode,
        coreClaim: refinement.coreClaim,
        topicScope: refinement.topicScope,
        topicCountryCode: refinement.topicCountryCode,
        countryDetectionReason: refinement.countryDetectionReason,
        generatedQueries,
        sources: createdSources.map((source) => ({
          id: source.id,
          sourceType: source.sourceType,
          publisherName: source.publisherName,
          canonicalUrl: source.canonicalUrl,
          rawTitle: source.rawTitle,
          rawSnippet: source.rawSnippet,
          relevanceTier: source.relevanceTier ?? "discard",
          relevanceReason: source.relevanceReason,
          originQueryIds: this.parseOriginQueryIds(source.originQueryIds),
          sourceCountryCode: source.sourceCountryCode,
          retrievalBucket: source.retrievalBucket,
          domainRegistryMatched: Boolean(source.domainRegistryId),
        })),
        evidenceSnippets: evidenceSnippets.map((snippet) => ({
          id: snippet.id,
          sourceId: snippet.sourceId,
          snippetText: snippet.snippetText,
        })),
        searchedSourceCount: createdSources.length,
        selectedSourceCount: extractionTargets.length,
        discardedSourceCount,
        handoff: {
          coreClaim: refinement.coreClaim,
          sourceIds: handoffSourceIds,
          snippetIds: evidenceSnippets.map((snippet) => snippet.id),
          insufficiencyReason,
        },
      };
    } catch (error) {
      await this.prisma.reviewJob.update({
        where: { id: reviewJob.id },
        data: {
          status: "failed",
          currentStage: "failed",
          lastErrorCode:
            error instanceof AppException ? error.code : APP_ERROR_CODES.INTERNAL_ERROR,
        },
      });

      throw error;
    }
  }

  async createTestQueryProcessingPreview(
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    const previewUser = await this.ensurePreviewUser();

    return this.createQueryProcessingPreview(previewUser.id, payload);
  }

  private shouldRunFallbackSearch(candidates: SearchCandidate[]): boolean {
    return (
      countRelevantSources(candidates) < PRIMARY_EXTRACTION_LIMIT ||
      !hasVerificationSource(candidates)
    );
  }

  private buildInsufficiencyReason(
    evidenceSnippetCount: number,
    extractionTargetCount: number,
    candidates: SearchCandidate[],
  ): string | null {
    if (evidenceSnippetCount === 0) {
      return "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.";
    }

    if (!hasVerificationSource(candidates)) {
      return "verification bucket source가 부족해 친숙한 국내 기사 중심으로 handoff 됩니다.";
    }

    if (extractionTargetCount < PRIMARY_EXTRACTION_LIMIT) {
      return "primary source가 충분하지 않아 reference 일부가 제한적으로 승격되었습니다.";
    }

    return null;
  }

  private async loadDomainRegistry(): Promise<DomainRegistryEntry[]> {
    const entries = await this.prisma.sourceDomainRegistry.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ priority: "asc" }, { countryCode: "asc" }],
    });

    return entries.map((entry) => ({
      id: entry.id,
      domain: entry.domain,
      countryCode: entry.countryCode,
      languageCode: entry.languageCode,
      sourceKind: entry.sourceKind,
      usageRole: entry.usageRole,
      priority: entry.priority,
      isActive: entry.isActive,
    }));
  }

  private async resolveUserCountryCode(userId: string): Promise<string | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: {
        userId,
      },
      select: {
        country: true,
      },
    });

    return normalizeCountryCode(profile?.country);
  }

  private parseOriginQueryIds(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  private async ensurePreviewUser(): Promise<{ id: string }> {
    const previewUser = await this.prisma.user.upsert({
      where: {
        email: "preview-api@varo.local",
      },
      update: {
        displayName: "VARO Preview API",
        profile: {
          upsert: {
            update: {
              country: "KR",
            },
            create: {
              country: "KR",
            },
          },
        },
      },
      create: {
        email: "preview-api@varo.local",
        displayName: "VARO Preview API",
        authProvider: "preview",
        profile: {
          create: {
            country: "KR",
          },
        },
      },
      select: {
        id: true,
      },
    });

    return {
      id: previewUser.id,
    };
  }
}
