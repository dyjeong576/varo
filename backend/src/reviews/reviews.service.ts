import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewQueryProcessingPreviewDto } from "./dto/create-review-query-processing-preview.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "./dto/review-query-processing-preview-response.dto";
import { ReviewsProvidersService } from "./reviews.providers.service";
import {
  deduplicateCandidates,
  normalizeClaimText,
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
      const refinement =
        await this.providersService.refineQuery(normalizedClaim);
      const generatedQueries = refinement.generatedQueries.slice(
        0,
        QUERY_COUNT_LIMIT,
      );
      const rawCandidates = await this.providersService.searchSources(
        generatedQueries,
        refinement.coreClaim,
      );
      const dedupedCandidates = deduplicateCandidates(rawCandidates).slice(
        0,
        RELEVANCE_LIMIT,
      );
      const relevanceCandidates =
        await this.providersService.applyRelevanceFiltering(
          refinement.coreClaim,
          dedupedCandidates,
        );

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
            publishedAt: candidate.publishedAt
              ? new Date(candidate.publishedAt)
              : null,
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
          .filter(
            (source) => source.fetchStatus === "fetched" && source.contentText,
          )
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
      const insufficiencyReason =
        evidenceSnippets.length === 0
          ? "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다."
          : extractionTargets.length < PRIMARY_EXTRACTION_LIMIT
            ? "primary source가 충분하지 않아 reference 일부가 제한적으로 승격되었습니다."
            : null;
      const handoffSourceIds = createdSources
        .filter((source) =>
          evidenceSnippets.some((snippet) => snippet.sourceId === source.id),
        )
        .map((source) => source.id);

      const queryRefinementPayload = {
        languageCode: refinement.languageCode,
        coreClaim: refinement.coreClaim,
        generatedQueries: generatedQueries.map((query) => ({
          id: query.id,
          text: query.text,
          rank: query.rank,
        })),
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
            evidenceSnippets.length === 0
              ? APP_ERROR_CODES.REVIEW_PARTIAL
              : null,
        },
      });

      return {
        reviewId: reviewJob.id,
        claimId: claim.id,
        status: "partial",
        currentStage: "handoff_ready",
        normalizedClaim,
        languageCode: refinement.languageCode,
        coreClaim: refinement.coreClaim,
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
            error instanceof AppException
              ? error.code
              : APP_ERROR_CODES.INTERNAL_ERROR,
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
      },
      create: {
        email: "preview-api@varo.local",
        displayName: "VARO Preview API",
        authProvider: "preview",
        profile: {
          create: {},
        },
      },
      select: {
        id: true,
        profile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!previewUser.profile) {
      await this.prisma.userProfile.create({
        data: {
          userId: previewUser.id,
        },
      });
    }

    return {
      id: previewUser.id,
    };
  }
}
