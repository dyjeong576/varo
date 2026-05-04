import { HttpStatus, Injectable } from "@nestjs/common";
import {
  Check,
  EvidenceSnippet,
  Prisma,
  AnswerJob,
  Source,
} from "@prisma/client";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EvidenceSignal,
  AnswerGeneratedSummary,
  QueryArtifact,
  QueryRefinementResult,
  SearchCandidate,
} from "../answers.types";
import {
  buildCompletedAnswerJobUpdate,
  buildHandoffPayload,
  buildHandoffSourceIds,
  buildInsufficiencyReason,
  buildQueryRefinementPayload,
  buildSourceCreateInputs
} from "./answers-query-preview.mapper";

interface PersistQueryPreviewResultInput {
  userId: string;
  answerJob: Pick<AnswerJob, "id">;
  refinement: QueryRefinementResult;
  generatedQueries: QueryArtifact[];
  relevanceCandidates: SearchCandidate[];
  evidenceSignals?: EvidenceSignal[];
  answerSummary?: AnswerGeneratedSummary | null;
  primaryExtractionLimit: number;
  existingSources?: Source[];
}

interface PersistSearchPreviewSourcesInput {
  answerJob: Pick<AnswerJob, "id">;
  refinement: QueryRefinementResult;
  generatedQueries: QueryArtifact[];
  candidates: SearchCandidate[];
}

export interface PersistedQueryPreviewArtifacts {
  createdSources: Source[];
  evidenceSnippets: EvidenceSnippet[];
  discardedSourceCount: number;
  handoffSourceIds: string[];
  insufficiencyReason: string | null;
  evidenceSignals: EvidenceSignal[];
  answerSummary: AnswerGeneratedSummary | null;
}

export interface PersistedOutOfScopeAnswer {
  insufficiencyReason: string;
}

type AnswerPreviewRecord = Prisma.AnswerJobGetPayload<{
  include: {
    check: true;
    sources: true;
    evidenceSnippets: true;
  };
}>;

type AnswerPreviewSummaryRecord = Prisma.AnswerJobGetPayload<{
  include: {
    check: true;
    sources: {
      select: {
        fetchStatus: true;
      };
    };
  };
}>;

function mapEvidenceSignalStance(signal: EvidenceSignal): string {
  if (
    signal.stanceToCheck === "contradicts" ||
    signal.stanceToCheck === "updates" ||
    signal.currentAnswerImpact === "weakens" ||
    signal.currentAnswerImpact === "overrides"
  ) {
    return "conflict";
  }

  if (
    signal.stanceToCheck === "supports" ||
    signal.currentAnswerImpact === "strengthens"
  ) {
    return "support";
  }

  if (signal.stanceToCheck === "context") {
    return "context";
  }

  return "unknown";
}

@Injectable()
export class AnswersQueryPreviewPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findQueryProcessingPreviewByClientRequestId(
    userId: string,
    clientRequestId: string,
  ): Promise<AnswerPreviewRecord | null> {
    return this.prisma.answerJob.findFirst({
      where: {
        userId,
        clientRequestId,
      },
      include: {
        check: true,
        sources: {
          orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        },
        evidenceSnippets: {
          orderBy: { id: "asc" },
        },
      },
    });
  }

  async createCheckAndAnswerJob(params: {
    userId: string;
    rawCheck: string;
    normalizedCheck: string;
    clientRequestId?: string;
  }): Promise<{
    check: Pick<Check, "id" | "rawText">;
    answerJob: Pick<AnswerJob, "id" | "createdAt" | "clientRequestId">;
  }> {
    const check = await this.prisma.check.create({
      data: {
        rawText: params.rawCheck,
        normalizedText: params.normalizedCheck,
      },
      select: {
        id: true,
        rawText: true,
      },
    });

    const answerJob = await this.prisma.answerJob.create({
      data: {
        userId: params.userId,
        checkId: check.id,
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

    return { check, answerJob };
  }

  async resetQueryProcessingPreview(answerJobId: string): Promise<void> {
    await this.prisma.evidenceSnippet.deleteMany({
      where: {
        answerJobId,
      },
    });
    await this.prisma.source.deleteMany({
      where: {
        answerJobId,
      },
    });
    await this.prisma.answerJob.update({
      where: { id: answerJobId },
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
  ): Promise<AnswerPreviewSummaryRecord[]> {
    return this.prisma.answerJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        check: true,
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
    answerId: string,
  ): Promise<AnswerPreviewRecord> {
    const answerJob =
      (await this.prisma.answerJob.findFirst({
        where: {
          id: answerId,
          userId,
        },
        include: {
          check: true,
          sources: {
            orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
          },
          evidenceSnippets: {
            orderBy: { id: "asc" },
          },
        },
      })) ??
      (await this.prisma.answerJob.findFirst({
        where: {
          id: answerId,
          handoffPayload: {
            not: Prisma.AnyNull,
          },
        },
        include: {
          check: true,
          sources: {
            orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
          },
          evidenceSnippets: {
            orderBy: { id: "asc" },
          },
        },
      }));

    if (!answerJob) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "answer를 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    return answerJob;
  }

  async deleteQueryProcessingPreview(
    userId: string,
    answerId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const answerJob = await tx.answerJob.findFirst({
        where: {
          id: answerId,
          userId,
        },
        select: {
          id: true,
          checkId: true,
        },
      });

      if (!answerJob) {
        throw new AppException(
          APP_ERROR_CODES.NOT_FOUND,
          "answer를 찾을 수 없습니다.",
          HttpStatus.NOT_FOUND,
        );
      }

      await tx.notification.deleteMany({
        where: {
          targetType: "answer",
          targetId: answerJob.id,
        },
      });

      await tx.answerJob.delete({
        where: {
          id: answerJob.id,
        },
      });

      const remainingAnswerCount = await tx.answerJob.count({
        where: {
          checkId: answerJob.checkId,
        },
      });

      if (remainingAnswerCount === 0) {
        await tx.check.deleteMany({
          where: {
            id: answerJob.checkId,
          },
        });
      }
    });
  }

  async recordHistoryEntry(params: {
    userId: string;
    answerJobId: string;
    entryType: "submitted" | "reopened";
  }): Promise<void> {
    await this.prisma.userHistory.create({
      data: {
        userId: params.userId,
        answerJobId: params.answerJobId,
        entryType: params.entryType,
      },
    });
  }

  async ensureReopenableAnswer(answerId: string): Promise<{
    id: string;
    handoffPayload: Prisma.JsonValue | null;
  }> {
    const answerJob = await this.prisma.answerJob.findUnique({
      where: { id: answerId },
      select: {
        id: true,
        handoffPayload: true,
      },
    });

    if (!answerJob || !answerJob.handoffPayload) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "answer를 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    return answerJob;
  }

  async persistQueryPreviewResult(
    input: PersistQueryPreviewResultInput,
  ): Promise<PersistedQueryPreviewArtifacts> {
    const createdSources = input.existingSources?.length
      ? await Promise.all(
          input.existingSources.map((source, index) => {
            const candidate = input.relevanceCandidates[index];

            return this.prisma.source.update({
              where: { id: source.id },
              data: {
                relevanceTier: candidate?.relevanceTier ?? source.relevanceTier,
                relevanceReason: candidate?.relevanceReason ?? source.relevanceReason,
              },
            });
          }),
        )
      : await Promise.all(
          buildSourceCreateInputs(
            input.answerJob.id,
            input.relevanceCandidates,
            [],
          ).map((data) => this.prisma.source.create({ data })),
        );

    const evidenceSnippets: EvidenceSnippet[] = [];
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
    const insufficiencyReason =
      input.refinement.answerMode === "direct_answer"
        ? null
        : buildInsufficiencyReason(
            input.relevanceCandidates,
            input.primaryExtractionLimit,
          );
    const handoffSourceIds = buildHandoffSourceIds(createdSources);
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
    );
    const handoffPayload = buildHandoffPayload(
      input.refinement.coreCheck,
      handoffSourceIds,
      updatedEvidenceSnippets.map((snippet) => snippet.id),
      insufficiencyReason,
      evidenceSignals,
      sourcePoliticalLeans,
      input.answerSummary ?? null,
    );

    await this.prisma.answerJob.update(
      buildCompletedAnswerJobUpdate(
        input.answerJob.id,
        createdSources.length,
        updatedEvidenceSnippets.length,
        queryRefinementPayload,
        handoffPayload,
        evidenceSignals.length > 0,
      ),
    );
    await this.recordHistoryEntry({
      userId: input.userId,
      answerJobId: input.answerJob.id,
      entryType: "submitted",
    });
    await this.notificationsService.createAnswerCompletedNotification({
      userId: input.userId,
      answerId: input.answerJob.id,
      check: input.refinement.coreCheck,
    });

    return {
      createdSources,
      evidenceSnippets: updatedEvidenceSnippets,
      discardedSourceCount,
      handoffSourceIds,
      insufficiencyReason,
      evidenceSignals,
      answerSummary: input.answerSummary ?? null,
    };
  }

  async persistSearchPreviewSources(
    input: PersistSearchPreviewSourcesInput,
  ): Promise<Source[]> {
    const sourceCreateInputs = buildSourceCreateInputs(
      input.answerJob.id,
      input.candidates,
      [],
    );
    const createdSources = await Promise.all(
      sourceCreateInputs.map((data) => this.prisma.source.create({ data })),
    );
    const queryRefinementPayload = buildQueryRefinementPayload(
      input.refinement,
      input.generatedQueries,
    );

    await this.prisma.answerJob.update({
      where: { id: input.answerJob.id },
      data: {
        status: "searching",
        currentStage: "relevance_and_signal_classification",
        searchedSourceCount: createdSources.length,
        processedSourceCount: 0,
        lastErrorCode: null,
        queryRefinement: queryRefinementPayload,
        handoffPayload: Prisma.DbNull,
      },
    });

    return createdSources;
  }

  async persistOutOfScopeAnswer(params: {
    userId: string;
    answerJob: Pick<AnswerJob, "id">;
    refinement: QueryRefinementResult;
    generatedQueries: QueryArtifact[];
  }): Promise<PersistedOutOfScopeAnswer> {
    const insufficiencyReason =
      "뉴스성 또는 사실성 검토 지원 범위 밖 check으로 기록되었습니다.";
    const queryRefinementPayload = buildQueryRefinementPayload(
      params.refinement,
      params.generatedQueries,
    );
    const handoffPayload = buildHandoffPayload(
      params.refinement.coreCheck,
      [],
      [],
      insufficiencyReason,
    );

    await this.prisma.answerJob.update({
      where: { id: params.answerJob.id },
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
      answerJobId: params.answerJob.id,
      entryType: "submitted",
    });
    await this.notificationsService.createAnswerCompletedNotification({
      userId: params.userId,
      answerId: params.answerJob.id,
      check: params.refinement.coreCheck,
    });

    return { insufficiencyReason };
  }

  async markAnswerJobFailed(answerJobId: string, error: unknown): Promise<void> {
    await this.prisma.answerJob.update({
      where: { id: answerJobId },
      data: {
        status: "failed",
        currentStage: "failed",
        lastErrorCode:
          error instanceof AppException ? error.code : APP_ERROR_CODES.INTERNAL_ERROR,
      },
    });
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

  validateNormalizedCheck(normalizedCheck: string): void {
    if (!normalizedCheck) {
      throw new AppException(
        APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
        "검토할 check을 입력해 주세요.",
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
