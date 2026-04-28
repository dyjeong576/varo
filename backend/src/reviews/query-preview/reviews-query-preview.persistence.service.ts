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
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EvidenceSignal,
  ExtractedSource,
  QueryArtifact,
  QueryRefinementResult,
  SearchCandidate,
} from "../reviews.types";
import { normalizeCountryCode } from "../reviews.utils";
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
  evidenceSignals?: EvidenceSignal[];
  primaryExtractionLimit: number;
}

export interface PersistedQueryPreviewArtifacts {
  createdSources: Source[];
  evidenceSnippets: EvidenceSnippet[];
  discardedSourceCount: number;
  handoffSourceIds: string[];
  insufficiencyReason: string | null;
  evidenceSignals: EvidenceSignal[];
}

export interface PersistedOutOfScopeReview {
  insufficiencyReason: string;
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

function mapEvidenceSignalStance(signal: EvidenceSignal): string {
  if (
    signal.stanceToClaim === "contradicts" ||
    signal.stanceToClaim === "updates" ||
    signal.currentAnswerImpact === "weakens" ||
    signal.currentAnswerImpact === "overrides"
  ) {
    return "conflict";
  }

  if (
    signal.stanceToClaim === "supports" ||
    signal.currentAnswerImpact === "strengthens"
  ) {
    return "support";
  }

  if (signal.stanceToClaim === "context") {
    return "context";
  }

  return "unknown";
}

@Injectable()
export class ReviewsQueryPreviewPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

  async deleteQueryProcessingPreview(
    userId: string,
    reviewId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reviewJob = await tx.reviewJob.findFirst({
        where: {
          id: reviewId,
          userId,
        },
        select: {
          id: true,
          claimId: true,
        },
      });

      if (!reviewJob) {
        throw new AppException(
          APP_ERROR_CODES.NOT_FOUND,
          "리뷰를 찾을 수 없습니다.",
          HttpStatus.NOT_FOUND,
        );
      }

      await tx.notification.deleteMany({
        where: {
          targetType: "review",
          targetId: reviewJob.id,
        },
      });

      await tx.reviewJob.delete({
        where: {
          id: reviewJob.id,
        },
      });

      const remainingReviewCount = await tx.reviewJob.count({
        where: {
          claimId: reviewJob.claimId,
        },
      });

      if (remainingReviewCount === 0) {
        await tx.claim.deleteMany({
          where: {
            id: reviewJob.claimId,
          },
        });
      }
    });
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
    const createdSourceByCandidateId = new Map(
      input.relevanceCandidates.map((candidate, index) => [
        candidate.id,
        createdSources[index],
      ]),
    );
    const snippetBySourceId = new Map(
      evidenceSnippets.map((snippet) => [snippet.sourceId, snippet]),
    );
    const evidenceSignals = (input.evidenceSignals ?? []).flatMap((signal) => {
      const source = createdSourceByCandidateId.get(signal.sourceId);

      if (!source) {
        return [];
      }

      const snippet = snippetBySourceId.get(source.id) ?? null;

      return [{ ...signal, sourceId: source.id, snippetId: snippet?.id ?? null }];
    });
    const stanceBySnippetId = new Map(
      evidenceSignals.flatMap((signal) =>
        signal.snippetId
          ? [[signal.snippetId, mapEvidenceSignalStance(signal)] as const]
          : [],
      ),
    );
    await Promise.all(
      Array.from(stanceBySnippetId.entries()).map(([snippetId, stance]) =>
        this.prisma.evidenceSnippet.update({
          where: { id: snippetId },
          data: { stance },
        }),
      ),
    );
    const updatedEvidenceSnippets = evidenceSnippets.map((snippet) => ({
      ...snippet,
      stance: stanceBySnippetId.get(snippet.id) ?? snippet.stance,
    }));

    const discardedSourceCount = createdSources.filter(
      (source) => source.relevanceTier === "discard",
    ).length;
    const insufficiencyReason = buildInsufficiencyReason(
      updatedEvidenceSnippets.length,
      input.extractionTargets.length,
      input.relevanceCandidates,
      input.primaryExtractionLimit,
    );
    const handoffSourceIds = buildHandoffSourceIds(
      createdSources,
      updatedEvidenceSnippets,
    );
    const sourcePoliticalLeans = Object.fromEntries(
      input.relevanceCandidates.flatMap((candidate) => {
        const source = createdSourceByCandidateId.get(candidate.id);

        return source && candidate.sourcePoliticalLean
          ? [[source.id, candidate.sourcePoliticalLean] as const]
          : [];
      }),
    );
    const queryRefinementPayload = buildQueryRefinementPayload(
      input.refinement,
      input.generatedQueries,
      input.userCountryCode,
    );
    const handoffPayload = buildHandoffPayload(
      input.refinement.coreClaim,
      handoffSourceIds,
      updatedEvidenceSnippets.map((snippet) => snippet.id),
      insufficiencyReason,
      evidenceSignals,
      sourcePoliticalLeans,
    );

    await this.prisma.reviewJob.update(
      buildCompletedReviewJobUpdate(
        input.reviewJob.id,
        createdSources.length,
        updatedEvidenceSnippets.length,
        queryRefinementPayload,
        handoffPayload,
        updatedEvidenceSnippets.length > 0,
      ),
    );
    await this.recordHistoryEntry({
      userId: input.userId,
      reviewJobId: input.reviewJob.id,
      entryType: "submitted",
    });
    await this.notificationsService.createReviewCompletedNotification({
      userId: input.userId,
      reviewId: input.reviewJob.id,
      claim: input.refinement.coreClaim,
    });

    return {
      createdSources,
      evidenceSnippets: updatedEvidenceSnippets,
      discardedSourceCount,
      handoffSourceIds,
      insufficiencyReason,
      evidenceSignals,
    };
  }

  async persistOutOfScopeReview(params: {
    userId: string;
    reviewJob: Pick<ReviewJob, "id">;
    refinement: QueryRefinementResult;
    generatedQueries: QueryArtifact[];
    userCountryCode: string | null;
  }): Promise<PersistedOutOfScopeReview> {
    const insufficiencyReason =
      "뉴스성 또는 사실성 검토 지원 범위 밖 claim으로 기록되었습니다.";
    const queryRefinementPayload = buildQueryRefinementPayload(
      params.refinement,
      params.generatedQueries,
      params.userCountryCode,
    );
    const handoffPayload = buildHandoffPayload(
      params.refinement.coreClaim,
      [],
      [],
      insufficiencyReason,
    );

    await this.prisma.reviewJob.update({
      where: { id: params.reviewJob.id },
      data: {
        status: "out_of_scope",
        currentStage: "scope_checked",
        searchedSourceCount: 0,
        processedSourceCount: 0,
        lastErrorCode: null,
        queryRefinement: queryRefinementPayload,
        handoffPayload,
      },
    });
    await this.recordHistoryEntry({
      userId: params.userId,
      reviewJobId: params.reviewJob.id,
      entryType: "submitted",
    });
    await this.notificationsService.createReviewCompletedNotification({
      userId: params.userId,
      reviewId: params.reviewJob.id,
      claim: params.refinement.coreClaim,
    });

    return { insufficiencyReason };
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
}
