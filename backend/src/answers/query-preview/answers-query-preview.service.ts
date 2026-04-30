import { Injectable, Logger } from "@nestjs/common";
import { AnswerJob, Source } from "@prisma/client";
import { AppException } from "../../common/exceptions/app-exception";
import { CreateAnswerQueryProcessingPreviewDto } from "../dto/create-answer-query-processing-preview.dto";
import { AnswerPreviewSummaryResponseDto } from "../dto/answer-preview-summary-response.dto";
import { AnswerQueryProcessingPreviewResponseDto } from "../dto/answer-query-processing-preview-response.dto";
import { AnswersProvidersService } from "../answers.providers.service";
import {
  AnswerGeneratedSummary,
  AnswerRelevanceTier,
  DirectAnswerCitation,
  QueryArtifact,
  QueryRefinementResult,
  RetrievalBucket,
  SearchCandidate,
  SearchProvider,
  SearchRoute,
} from "../answers.types";
import {
  buildCanonicalUrl,
  buildNormalizedHash,
  classifySourceType,
  deduplicateCandidates,
  extractHostname,
  getKoreanSearchDomainRegistry,
  normalizeCheckText,
} from "../answers.utils";
import {
  mapOutOfScopePreviewResponse, mapPreviewResponse, mapSearchPreviewResponse,
  mapStoredPreviewResponse,
  mapStoredPreviewSummary
} from "./answers-query-preview.mapper";
import { AnswersQueryPreviewPersistenceService } from "./answers-query-preview.persistence.service";

const RELEVANCE_LIMIT = 8;
const PRIMARY_EXTRACTION_LIMIT = 5;
const REFERENCE_PROMOTION_LIMIT = 3;

@Injectable()
export class AnswersQueryPreviewService {
  private readonly logger = new Logger(AnswersQueryPreviewService.name);

  constructor(
    private readonly persistenceService: AnswersQueryPreviewPersistenceService,
    private readonly providersService: AnswersProvidersService,
  ) {}

  async createQueryProcessingPreview(
    userId: string,
    payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    const normalizedCheck = normalizeCheckText(payload.check);
    this.persistenceService.validateNormalizedCheck(normalizedCheck);

    const existingAnswer =
      payload.clientRequestId &&
      (await this.persistenceService.findQueryProcessingPreviewByClientRequestId(
        userId,
        payload.clientRequestId,
      ));

    if (
      existingAnswer &&
      existingAnswer.status !== "searching" &&
      existingAnswer.status !== "failed"
    ) {
      return mapStoredPreviewResponse(existingAnswer);
    }

    const { check, answerJob } = existingAnswer
      ? {
          check: {
            id: existingAnswer.check.id,
            rawText: existingAnswer.check.rawText,
          },
          answerJob: {
            id: existingAnswer.id,
            createdAt: existingAnswer.createdAt,
            clientRequestId: existingAnswer.clientRequestId,
          },
        }
      : await this.persistenceService.createCheckAndAnswerJob({
          userId,
          rawCheck: payload.check,
          normalizedCheck,
          clientRequestId: payload.clientRequestId,
        });

    if (existingAnswer) {
      await this.persistenceService.resetQueryProcessingPreview(answerJob.id);
    }

    try {
      const startedAt = Date.now();
      const refinementStartedAt = Date.now();
      const refinement = await this.providersService.refineQuery(normalizedCheck);
      this.logStageDuration("query_refinement", refinementStartedAt, answerJob.id);
      const generatedQueries = refinement.generatedQueries;
      const searchRoute = refinement.searchRoute;
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
          await this.persistenceService.persistOutOfScopeAnswer({
            userId,
            answerJob,
            refinement,
            generatedQueries,
          });

        return mapOutOfScopePreviewResponse({
          answerJob,
          check,
          createdAt: answerJob.createdAt,
          normalizedCheck,
          refinement,
          generatedQueries,
          insufficiencyReason: persistedOutOfScope.insufficiencyReason,
        });
      }

      if (searchRoute === "llm_direct") {
        const directAnswerStartedAt = Date.now();
        const directAnswer = await this.providersService.answerDirectly(refinement.coreCheck);
        this.logStageDuration("llm_direct_answer", directAnswerStartedAt, answerJob.id);

        const citationCandidates = this.buildCitationCandidates(directAnswer.citations);
        const answerSummary: AnswerGeneratedSummary = {
          analysisSummary: directAnswer.answerText,
          uncertaintySummary:
            "실시간 웹 검색 기반 답변입니다. 중요한 결정 전에 공식 출처를 직접 확인하세요.",
          uncertaintyItems: [],
        };

        const persistedArtifacts =
          await this.persistenceService.persistQueryPreviewResult({
            userId,
            answerJob,
            refinement,
            generatedQueries,
            relevanceCandidates: citationCandidates,
            evidenceSignals: [],
            answerSummary,
            primaryExtractionLimit: PRIMARY_EXTRACTION_LIMIT,
          });

        return mapPreviewResponse({
          answerJob,
          check,
          createdAt: answerJob.createdAt,
          normalizedCheck,
          refinement,
          generatedQueries,
          sources: persistedArtifacts.createdSources,
          evidenceSnippets: persistedArtifacts.evidenceSnippets,
          selectedSourceCount: citationCandidates.length,
          discardedSourceCount: 0,
          handoffSourceIds: persistedArtifacts.handoffSourceIds,
          insufficiencyReason: persistedArtifacts.insufficiencyReason,
          evidenceSignals: [],
          answerSummary,
        });
      }

      const sourceSearchStartedAt = Date.now();
      const initialCandidates = await this.providersService.searchSources({
        searchRoute,
        queries: sourceQueries,
        coreCheck: refinement.coreCheck,
        domainRegistry: getKoreanSearchDomainRegistry(),
      });
      const relevanceStartedAt = Date.now();
      const relevanceSignalResult =
        await this.providersService.classifyRelevanceAndEvidenceSignals({
          coreCheck: refinement.coreCheck,
          searchRoute,
          searchPlan: refinement.searchPlan,
          candidates: this.selectClassificationCandidates(initialCandidates, sourceQueries),
        });
      this.logStageDuration(
        "relevance_and_signal_classification",
        relevanceStartedAt,
        answerJob.id,
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
          answerJob,
          refinement,
          generatedQueries,
          relevanceCandidates,
          evidenceSignals,
          answerSummary: relevanceSignalResult.answerSummary ?? null,
          primaryExtractionLimit: PRIMARY_EXTRACTION_LIMIT,
        });

      return mapPreviewResponse({
        answerJob,
        check,
        createdAt: answerJob.createdAt,
        normalizedCheck,
        refinement,
        generatedQueries,
        sources: persistedArtifacts.createdSources,
        evidenceSnippets: persistedArtifacts.evidenceSnippets,
        selectedSourceCount: evidenceSignals.length,
        discardedSourceCount: persistedArtifacts.discardedSourceCount,
        handoffSourceIds: persistedArtifacts.handoffSourceIds,
        insufficiencyReason: persistedArtifacts.insufficiencyReason,
        evidenceSignals: persistedArtifacts.evidenceSignals,
        answerSummary: persistedArtifacts.answerSummary,
      });
    } catch (error) {
      this.logger.error(
        this.buildPreviewFailureLogMessage({
          userId,
          answerJobId: answerJob.id,
          checkId: check.id,
          clientRequestId: answerJob.clientRequestId ?? payload.clientRequestId ?? null,
          error,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      await this.persistenceService.markAnswerJobFailed(answerJob.id, error);
      throw error;
    }
  }

  async createQueryProcessingPreviewAsync(
    userId: string,
    payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    const normalizedCheck = normalizeCheckText(payload.check);
    this.persistenceService.validateNormalizedCheck(normalizedCheck);

    const existingAnswer =
      payload.clientRequestId &&
      (await this.persistenceService.findQueryProcessingPreviewByClientRequestId(
        userId,
        payload.clientRequestId,
      ));

    if (existingAnswer && existingAnswer.status !== "failed") {
      return mapStoredPreviewResponse(existingAnswer);
    }

    const { check, answerJob } = existingAnswer
      ? {
          check: {
            id: existingAnswer.check.id,
            rawText: existingAnswer.check.rawText,
          },
          answerJob: {
            id: existingAnswer.id,
            createdAt: existingAnswer.createdAt,
            clientRequestId: existingAnswer.clientRequestId,
          },
        }
      : await this.persistenceService.createCheckAndAnswerJob({
          userId,
          rawCheck: payload.check,
          normalizedCheck,
          clientRequestId: payload.clientRequestId,
        });

    if (existingAnswer) {
      await this.persistenceService.resetQueryProcessingPreview(answerJob.id);
    }

    try {
      const refinementStartedAt = Date.now();
      const refinement = await this.providersService.refineQuery(normalizedCheck);
      this.logStageDuration("query_refinement", refinementStartedAt, answerJob.id);
      const generatedQueries = refinement.generatedQueries;
      const searchRoute = refinement.searchRoute;
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
          await this.persistenceService.persistOutOfScopeAnswer({
            userId,
            answerJob,
            refinement,
            generatedQueries,
          });

        return mapOutOfScopePreviewResponse({
          answerJob,
          check,
          createdAt: answerJob.createdAt,
          normalizedCheck,
          refinement,
          generatedQueries,
          insufficiencyReason: persistedOutOfScope.insufficiencyReason,
        });
      }

      if (searchRoute === "llm_direct") {
        const directAnswerStartedAt = Date.now();
        const directAnswer = await this.providersService.answerDirectly(refinement.coreCheck);
        this.logStageDuration("llm_direct_answer", directAnswerStartedAt, answerJob.id);

        const citationCandidates = this.buildCitationCandidates(directAnswer.citations);
        const answerSummary: AnswerGeneratedSummary = {
          analysisSummary: directAnswer.answerText,
          uncertaintySummary:
            "실시간 웹 검색 기반 답변입니다. 중요한 결정 전에 공식 출처를 직접 확인하세요.",
          uncertaintyItems: [],
        };

        const persistedArtifacts =
          await this.persistenceService.persistQueryPreviewResult({
            userId,
            answerJob,
            refinement,
            generatedQueries,
            relevanceCandidates: citationCandidates,
            evidenceSignals: [],
            answerSummary,
            primaryExtractionLimit: PRIMARY_EXTRACTION_LIMIT,
          });

        return mapPreviewResponse({
          answerJob,
          check,
          createdAt: answerJob.createdAt,
          normalizedCheck,
          refinement,
          generatedQueries,
          sources: persistedArtifacts.createdSources,
          evidenceSnippets: persistedArtifacts.evidenceSnippets,
          selectedSourceCount: citationCandidates.length,
          discardedSourceCount: 0,
          handoffSourceIds: persistedArtifacts.handoffSourceIds,
          insufficiencyReason: persistedArtifacts.insufficiencyReason,
          evidenceSignals: [],
          answerSummary,
        });
      }

      const initialCandidates = await this.providersService.searchSources({
        searchRoute,
        queries: sourceQueries,
        coreCheck: refinement.coreCheck,
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
          answerJob,
          refinement,
          generatedQueries,
          candidates: previewCandidates,
        });

      void this.completeAsyncQueryProcessingPreview({
        userId,
        answerJob,
        refinement,
        generatedQueries,
        candidates: classificationCandidates,
        existingSources: createdSources,
      });

      return mapSearchPreviewResponse({
        answerJob,
        check,
        createdAt: answerJob.createdAt,
        normalizedCheck,
        refinement,
        generatedQueries,
        sources: createdSources,
      });
    } catch (error) {
      this.logger.error(
        this.buildPreviewFailureLogMessage({
          userId,
          answerJobId: answerJob.id,
          checkId: check.id,
          clientRequestId: answerJob.clientRequestId ?? payload.clientRequestId ?? null,
          error,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      await this.persistenceService.markAnswerJobFailed(answerJob.id, error);
      throw error;
    }
  }

  async createTestQueryProcessingPreview(
    payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    const previewUser = await this.persistenceService.ensurePreviewUser();

    return this.createQueryProcessingPreview(previewUser.id, payload);
  }

  private async completeAsyncQueryProcessingPreview(params: {
    userId: string;
    answerJob: Pick<AnswerJob, "id">;
    refinement: QueryRefinementResult;
    generatedQueries: QueryArtifact[];
    candidates: SearchCandidate[];
    existingSources: Source[];
  }): Promise<void> {
    try {
      const relevanceStartedAt = Date.now();
      const relevanceSignalResult =
        await this.providersService.classifyRelevanceAndEvidenceSignals({
          coreCheck: params.refinement.coreCheck,
          searchRoute: params.refinement.searchRoute,
          searchPlan: params.refinement.searchPlan,
          candidates: params.candidates,
        });
      this.logStageDuration(
        "relevance_and_signal_classification",
        relevanceStartedAt,
        params.answerJob.id,
      );
      const evidenceSignals = relevanceSignalResult.evidenceSignals.slice(
        0,
        PRIMARY_EXTRACTION_LIMIT + REFERENCE_PROMOTION_LIMIT,
      );

      await this.persistenceService.persistQueryPreviewResult({
        userId: params.userId,
        answerJob: params.answerJob,
        refinement: params.refinement,
        generatedQueries: params.generatedQueries,
        relevanceCandidates: relevanceSignalResult.relevanceCandidates,
        evidenceSignals,
        answerSummary: relevanceSignalResult.answerSummary ?? null,
        primaryExtractionLimit: PRIMARY_EXTRACTION_LIMIT,
        existingSources: params.existingSources,
      });
    } catch (error) {
      this.logger.error(
        this.buildPreviewFailureLogMessage({
          userId: params.userId,
          answerJobId: params.answerJob.id,
          checkId: "unknown",
          clientRequestId: null,
          error,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      await this.persistenceService.markAnswerJobFailed(params.answerJob.id, error);
    }
  }

  private buildCitationCandidates(citations: DirectAnswerCitation[]): SearchCandidate[] {
    return citations.map((citation, index) => {
      const canonicalUrl = buildCanonicalUrl(citation.url);
      const hostname = extractHostname(canonicalUrl);

      return {
        id: `perplexity-${index + 1}`,
        searchRoute: "llm_direct" as SearchRoute,
        sourceProvider: "perplexity-sonar" as SearchProvider,
        sourceType: classifySourceType(canonicalUrl, ""),
        publisherName: hostname,
        publishedAt: citation.publishedAt ?? null,
        canonicalUrl,
        originalUrl: citation.url,
        rawTitle: citation.title ?? hostname ?? canonicalUrl,
        rawSnippet: citation.snippet ?? null,
        normalizedHash: buildNormalizedHash(canonicalUrl),
        originQueryIds: ["q1"],
        retrievalBucket: "familiar" as RetrievalBucket,
        domainRegistryId: null,
        relevanceTier: "primary" as AnswerRelevanceTier,
        relevanceReason: "Perplexity sonar 실시간 검색 인용 출처",
      };
    });
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
  ): Promise<AnswerPreviewSummaryResponseDto[]> {
    const answerJobs =
      await this.persistenceService.listRecentQueryProcessingPreviews(userId);

    return answerJobs.map(mapStoredPreviewSummary);
  }

  async getQueryProcessingPreview(
    userId: string,
    answerId: string,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    const answerJob = await this.persistenceService.getQueryProcessingPreview(
      userId,
      answerId,
    );

    return mapStoredPreviewResponse(answerJob);
  }

  async deleteQueryProcessingPreview(
    userId: string,
    answerId: string,
  ): Promise<void> {
    await this.persistenceService.deleteQueryProcessingPreview(userId, answerId);
  }

  async recordAnswerReopen(
    userId: string,
    answerId: string,
  ): Promise<void> {
    const answerJob = await this.persistenceService.ensureReopenableAnswer(answerId);

    await this.persistenceService.recordHistoryEntry({
      userId,
      answerJobId: answerJob.id,
      entryType: "reopened",
    });
  }

  private buildPreviewFailureLogMessage(params: {
    userId: string;
    answerJobId: string;
    checkId: string;
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
      "answer query processing preview failed",
      `userId=${params.userId}`,
      `answerJobId=${params.answerJobId}`,
      `checkId=${params.checkId}`,
      `clientRequestId=${params.clientRequestId ?? "none"}`,
      `errorCode=${errorCode}`,
      `errorMessage=${errorMessage}`,
    ].join(" ");
  }

  private logStageDuration(
    stage: string,
    startedAt: number,
    answerJobId: string,
  ): void {
    this.logger.log(
      `answer preview stage ${stage} completed in ${Date.now() - startedAt}ms; answerJobId=${answerJobId}`,
    );
  }
}
