import { HttpStatus, Injectable } from "@nestjs/common";
import {
  Claim,
  EvidenceSnippet,
  Prisma,
  ReviewJob,
  Source,
} from "@prisma/client";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DomainRegistryEntry,
  ExtractedSource,
  QueryArtifact,
  QueryRefinementResult,
  SearchCandidate,
} from "../reviews.types";
import {
  collectSearchDomainRegistryCriteria,
  normalizeCountryCode,
} from "../reviews.utils";
import {
  buildCompletedReviewJobUpdate,
  buildEvidenceSnippetCreateInputs,
  buildHandoffPayload,
  buildHandoffSourceIds,
  buildInsufficiencyReason,
  buildQueryRefinementPayload,
  buildSourceCreateInputs,
} from "./reviews-query-preview.mapper";

interface PersistQueryPreviewResultInput {
  userId: string;
  reviewJob: Pick<ReviewJob, "id">;
  refinement: QueryRefinementResult;
  generatedQueries: QueryArtifact[];
  userCountryCode: string | null;
  relevanceCandidates: SearchCandidate[];
  extractionTargets: SearchCandidate[];
  extractedSources: ExtractedSource[];
  primaryExtractionLimit: number;
}

export interface PersistedQueryPreviewArtifacts {
  createdSources: Source[];
  evidenceSnippets: EvidenceSnippet[];
  discardedSourceCount: number;
  handoffSourceIds: string[];
  insufficiencyReason: string | null;
}

type ReviewPreviewRecord = Prisma.ReviewJobGetPayload<{
  include: {
    claim: true;
    sources: true;
    evidenceSnippets: true;
  };
}>;

type ReviewPreviewSummaryRecord = Prisma.ReviewJobGetPayload<{
  include: {
    claim: true;
    sources: {
      select: {
        fetchStatus: true;
      };
    };
  };
}>;

@Injectable()
export class ReviewsQueryPreviewPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async findQueryProcessingPreviewByClientRequestId(
    userId: string,
    clientRequestId: string,
  ): Promise<ReviewPreviewRecord | null> {
    return this.prisma.reviewJob.findFirst({
      where: {
        userId,
        clientRequestId,
      },
      include: {
        claim: true,
        sources: {
          orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        },
        evidenceSnippets: {
          orderBy: { id: "asc" },
        },
      },
    });
  }

  async createClaimAndReviewJob(params: {
    userId: string;
    rawClaim: string;
    normalizedClaim: string;
    clientRequestId?: string;
  }): Promise<{
    claim: Pick<Claim, "id" | "rawText">;
    reviewJob: Pick<ReviewJob, "id" | "createdAt" | "clientRequestId">;
  }> {
    const claim = await this.prisma.claim.create({
      data: {
        rawText: params.rawClaim,
        normalizedText: params.normalizedClaim,
      },
      select: {
        id: true,
        rawText: true,
      },
    });

    const reviewJob = await this.prisma.reviewJob.create({
      data: {
        userId: params.userId,
        claimId: claim.id,
        clientRequestId: params.clientRequestId,
        status: "searching",
        currentStage: "query_refinement",
      },
      select: {
        id: true,
        createdAt: true,
        clientRequestId: true,
      },
    });

    return { claim, reviewJob };
  }

  async resetQueryProcessingPreview(reviewJobId: string): Promise<void> {
    await this.prisma.evidenceSnippet.deleteMany({
      where: {
        reviewJobId,
      },
    });
    await this.prisma.source.deleteMany({
      where: {
        reviewJobId,
      },
    });
    await this.prisma.reviewJob.update({
      where: { id: reviewJobId },
      data: {
        status: "searching",
        currentStage: "query_refinement",
        searchedSourceCount: 0,
        processedSourceCount: 0,
        retryCount: {
          increment: 1,
        },
        lastErrorCode: null,
        queryRefinement: Prisma.DbNull,
        handoffPayload: Prisma.DbNull,
      },
    });
  }

  async listRecentQueryProcessingPreviews(
    userId: string,
  ): Promise<ReviewPreviewSummaryRecord[]> {
    return this.prisma.reviewJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        claim: true,
        sources: {
          select: {
            fetchStatus: true,
          },
        },
      },
    });
  }

  async getQueryProcessingPreview(
    userId: string,
    reviewId: string,
  ): Promise<ReviewPreviewRecord> {
    const reviewJob = await this.prisma.reviewJob.findFirst({
      where: {
        id: reviewId,
        userId,
      },
      include: {
        claim: true,
        sources: {
          orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        },
        evidenceSnippets: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!reviewJob) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "리뷰를 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    return reviewJob;
  }

  async recordHistoryEntry(params: {
    userId: string;
    reviewJobId: string;
    entryType: "submitted" | "reopened";
  }): Promise<void> {
    await this.prisma.userHistory.create({
      data: {
        userId: params.userId,
        reviewJobId: params.reviewJobId,
        entryType: params.entryType,
      },
    });
  }

  async ensureReopenableReview(reviewId: string): Promise<{
    id: string;
    handoffPayload: Prisma.JsonValue | null;
  }> {
    const reviewJob = await this.prisma.reviewJob.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        handoffPayload: true,
      },
    });

    if (!reviewJob || !reviewJob.handoffPayload) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "리뷰를 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    return reviewJob;
  }

  async persistQueryPreviewResult(
    input: PersistQueryPreviewResultInput,
  ): Promise<PersistedQueryPreviewArtifacts> {
    const sourceCreateInputs = buildSourceCreateInputs(
      input.reviewJob.id,
      input.relevanceCandidates,
      input.extractedSources,
    );
    const createdSources = await Promise.all(
      sourceCreateInputs.map((data) => this.prisma.source.create({ data })),
    );

    const evidenceSnippetCreateInputs = buildEvidenceSnippetCreateInputs(
      input.reviewJob.id,
      createdSources,
      input.extractedSources,
    );
    const evidenceSnippets = await Promise.all(
      evidenceSnippetCreateInputs.map((data) =>
        this.prisma.evidenceSnippet.create({ data }),
      ),
    );

    const discardedSourceCount = createdSources.filter(
      (source) => source.relevanceTier === "discard",
    ).length;
    const insufficiencyReason = buildInsufficiencyReason(
      evidenceSnippets.length,
      input.extractionTargets.length,
      input.relevanceCandidates,
      input.primaryExtractionLimit,
    );
    const handoffSourceIds = buildHandoffSourceIds(createdSources, evidenceSnippets);
    const queryRefinementPayload = buildQueryRefinementPayload(
      input.refinement,
      input.generatedQueries,
      input.userCountryCode,
    );
    const handoffPayload = buildHandoffPayload(
      input.refinement.coreClaim,
      handoffSourceIds,
      evidenceSnippets.map((snippet) => snippet.id),
      insufficiencyReason,
    );

    await this.prisma.reviewJob.update(
      buildCompletedReviewJobUpdate(
        input.reviewJob.id,
        createdSources.length,
        evidenceSnippets.length,
        queryRefinementPayload,
        handoffPayload,
        evidenceSnippets.length > 0,
      ),
    );
    await this.recordHistoryEntry({
      userId: input.userId,
      reviewJobId: input.reviewJob.id,
      entryType: "submitted",
    });

    return {
      createdSources,
      evidenceSnippets,
      discardedSourceCount,
      handoffSourceIds,
      insufficiencyReason,
    };
  }

  async markReviewJobFailed(reviewJobId: string, error: unknown): Promise<void> {
    await this.prisma.reviewJob.update({
      where: { id: reviewJobId },
      data: {
        status: "failed",
        currentStage: "failed",
        lastErrorCode:
          error instanceof AppException ? error.code : APP_ERROR_CODES.INTERNAL_ERROR,
      },
    });
  }

  async loadSearchDomainRegistry(params: {
    userCountryCode: string | null;
    topicCountryCode: string | null;
    topicScope: QueryRefinementResult["topicScope"];
  }): Promise<DomainRegistryEntry[]> {
    const criteria = collectSearchDomainRegistryCriteria(
      params.userCountryCode,
      params.topicCountryCode,
      params.topicScope,
    );
    const entries = await this.prisma.sourceDomainRegistry.findMany({
      where: {
        isActive: true,
        usageRole: {
          in: criteria.usageRoles,
        },
        countryCode: {
          in: criteria.countryCodes,
        },
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

  async resolveUserCountryCode(userId: string): Promise<string | null> {
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

  async ensurePreviewUser(): Promise<{ id: string }> {
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

  validateNormalizedClaim(normalizedClaim: string): void {
    if (!normalizedClaim) {
      throw new AppException(
        APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
        "검토할 claim을 입력해 주세요.",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private get db(): any {
    return this.prisma as any;
  }
}
