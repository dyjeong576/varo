import { HttpStatus, Injectable } from "@nestjs/common";
import type { Claim, EvidenceSnippet, ReviewJob, Source } from "@prisma/client";
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

@Injectable()
export class ReviewsQueryPreviewPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async createClaimAndReviewJob(params: {
    userId: string;
    rawClaim: string;
    normalizedClaim: string;
  }): Promise<{ claim: Pick<Claim, "id">; reviewJob: Pick<ReviewJob, "id"> }> {
    const claim = await this.prisma.claim.create({
      data: {
        rawText: params.rawClaim,
        normalizedText: params.normalizedClaim,
      },
    });

    const reviewJob = await this.prisma.reviewJob.create({
      data: {
        userId: params.userId,
        claimId: claim.id,
        status: "searching",
        currentStage: "query_refinement",
      },
    });

    return { claim, reviewJob };
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
  }): Promise<DomainRegistryEntry[]> {
    const criteria = collectSearchDomainRegistryCriteria(
      params.userCountryCode,
      params.topicCountryCode,
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
}
