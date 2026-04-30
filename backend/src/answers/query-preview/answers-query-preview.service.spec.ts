import { HttpStatus, Logger } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { AnswersProvidersService } from "../answers.providers.service";
import { AnswersQueryPreviewService } from "./answers-query-preview.service";

describe("AnswersQueryPreviewService", () => {
  const createPersistenceMock = () => ({
    validateNormalizedCheck: jest.fn((normalizedCheck: string) => {
      if (!normalizedCheck) {
        throw new AppException(
          APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
          "검토할 check을 입력해 주세요.",
          HttpStatus.BAD_REQUEST,
        );
      }
    }),
    findQueryProcessingPreviewByClientRequestId: jest.fn().mockResolvedValue(null),
    createCheckAndAnswerJob: jest.fn().mockImplementation(
      ({ clientRequestId }: { clientRequestId?: string }) =>
        Promise.resolve({
          check: {
            id: "check-1",
            rawText: "트럼프가 오늘 관세 발표했대",
          },
          answerJob: {
            id: "answer-1",
            createdAt: new Date("2026-04-01T02:00:00.000Z"),
            clientRequestId: clientRequestId ?? null,
          },
        }),
    ),
    resetQueryProcessingPreview: jest.fn().mockResolvedValue(undefined),
    persistQueryPreviewResult: jest.fn(),
    persistSearchPreviewSources: jest.fn(),
    persistOutOfScopeAnswer: jest.fn().mockResolvedValue({
      insufficiencyReason:
        "뉴스성 또는 사실성 검토 지원 범위 밖 check으로 기록되었습니다.",
    }),
    markAnswerJobFailed: jest.fn().mockResolvedValue(undefined),
    ensurePreviewUser: jest.fn().mockResolvedValue({
      id: "preview-user-1",
    }),
    listRecentQueryProcessingPreviews: jest.fn().mockResolvedValue([]),
    getQueryProcessingPreview: jest.fn(),
    deleteQueryProcessingPreview: jest.fn().mockResolvedValue(undefined),
    ensureReopenableAnswer: jest.fn().mockResolvedValue({
      id: "answer-1",
      handoffPayload: {
        sourceIds: ["source-1"],
      },
    }),
    recordHistoryEntry: jest.fn().mockResolvedValue(undefined),
  });
  const flushPromises = () =>
    new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

  it("빈 check이면 입력 검증 예외를 던진다", async () => {
    const persistence = createPersistenceMock();
    const service = new AnswersQueryPreviewService(
      persistence as never,
      {} as never,
    );

    await expect(
      service.createQueryProcessingPreview("user-1", {
        check: "   ",
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(persistence.createCheckAndAnswerJob).not.toHaveBeenCalled();
  });

  it("사용자 국가와 무관하게 주제 국가를 유지하고 Naver 검색 경로로 source를 수집한다", async () => {
    const persistence = createPersistenceMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "트럼프의 관세 발표",
        normalizedCheck: "트럼프가 관세를 발표했다",
        checkType: "policy",
        isFactCheckQuestion: true,
        searchPlan: {
          queries: [
            {
              id: "sp1",
              purpose: "check_specific",
              query: "트럼프 관세 발표",
              priority: 1,
            },
            {
              id: "sp2",
              purpose: "current_state",
              query: "트럼프 관세 최신 뉴스",
              priority: 2,
            },
            {
              id: "sp3",
              purpose: "primary_source",
              query: "백악관 트럼프 관세 발표",
              priority: 3,
            },
            {
              id: "sp4",
              purpose: "contradiction_or_update",
              query: "트럼프 관세 발표 정정 업데이트",
              priority: 4,
            },
          ],
        },
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "Trump tariff announcement", rank: 2 },
          { id: "q3", text: "미국 관세 정책 발표", rank: 3 },
        ],
        searchRoute: "supported",
        searchRouteReason: "한국 시장 영향이 직접 포함된 한국 뉴스성 check입니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([
        {
          id: "c1",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: "2026-04-01T00:00:00.000Z",
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "트럼프 관세 발표 관련 한국 보도",
          rawSnippet: "국내 종합 기사입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
        {
          id: "c2",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: "2026-04-01T01:00:00.000Z",
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          normalizedHash: "hash-2",
          originQueryIds: ["q2"],
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
        },
      ]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      classifyRelevanceAndEvidenceSignals: jest
        .fn()
        .mockImplementation(async ({ candidates }) =>
          ({
            relevanceCandidates: candidates.map((candidate: Record<string, unknown>) => ({
              ...candidate,
              relevanceTier:
                candidate.retrievalBucket === "verification" ? "primary" : "reference",
              relevanceReason:
                candidate.retrievalBucket === "verification"
                  ? "원문 검증 source입니다."
                  : "국내 친숙형 보도로 보조 근거입니다.",
            })),
            evidenceSignals: [
              {
                sourceId: "c2",
                snippetId: null,
                stanceToCheck: "supports",
                temporalRole: "current_status",
                updateType: "confirmation",
                currentAnswerImpact: "strengthens",
                reason: "원문 검증 보도입니다.",
              },
            ],
          }),
        ),
      extractContent: jest.fn().mockResolvedValue([
        {
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          contentText: "추출 본문",
          snippetText: "추출 snippet",
        },
      ]),
      classifyEvidenceSignals: jest.fn(),
    } as unknown as AnswersProvidersService;
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [
        {
          id: "source-1",
          sourceType: "news",
          publisherName: "연합뉴스",
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "트럼프 관세 발표 관련 한국 보도",
          rawSnippet: "국내 종합 기사입니다.",
          relevanceTier: "reference",
          relevanceReason: "국내 친숙형 보도로 보조 근거입니다.",
          originQueryIds: ["q1"],
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
        {
          id: "source-2",
          sourceType: "news",
          publisherName: "Reuters",
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          relevanceTier: "primary",
          relevanceReason: "원문 검증 source입니다.",
          originQueryIds: ["q2"],
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
        },
      ],
      evidenceSnippets: [
        {
          id: "snippet-source-2",
          answerJobId: "answer-1",
          sourceId: "source-2",
          snippetText: "추출 snippet",
          stance: "neutral",
          startOffset: null,
          endOffset: null,
        },
      ],
      discardedSourceCount: 0,
      handoffSourceIds: ["source-2"],
      insufficiencyReason: "primary source가 충분하지 않아 reference 일부가 제한적으로 승격되었습니다.",
      evidenceSignals: [
        {
          sourceId: "source-2",
          snippetId: "snippet-source-2",
          stanceToCheck: "supports",
          temporalRole: "current_status",
          updateType: "confirmation",
          currentAnswerImpact: "strengthens",
          reason: "원문 검증 보도입니다.",
        },
      ],
    });
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      check: "트럼프가 오늘 관세 발표했대",
    });

    expect(result.answerId).toBe("answer-1");
    expect(result.rawCheck).toBe("트럼프가 오늘 관세 발표했대");
    expect(result.createdAt).toBe("2026-04-01T02:00:00.000Z");
    expect(result.generatedQueries).toHaveLength(3);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]?.retrievalBucket).toBe("familiar");
    expect(result.sources[1]?.retrievalBucket).toBe("verification");
    expect(result.sources[1]?.domainRegistryMatched).toBe(false);
    expect(result.evidenceSnippets).toHaveLength(1);
    expect(result.evidenceSnippets[0]?.evidenceSummary).toBe("원문 검증 source입니다.");
    expect(providers.classifyRelevanceAndEvidenceSignals).toHaveBeenCalledWith(
      expect.objectContaining({
        coreCheck: "트럼프의 관세 발표",
        candidates: expect.arrayContaining([
          expect.objectContaining({
            id: "c2",
            rawSnippet: "원문 검증 보도입니다.",
          }),
        ]),
      }),
    );
    expect(providers.classifyEvidenceSignals).not.toHaveBeenCalled();
    expect(persistence.persistQueryPreviewResult).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceSignals: [
          expect.objectContaining({
            sourceId: "c2",
            currentAnswerImpact: "strengthens",
          }),
        ],
      }),
    );
    expect(providers.searchSources).toHaveBeenCalledWith(
      expect.objectContaining({
        searchRoute: "supported",
        queries: [
          {
            id: "sp1",
            text: "트럼프 관세 발표",
            rank: 1,
            purpose: "check_specific",
          },
          {
            id: "sp2",
            text: "트럼프 관세 최신 뉴스",
            rank: 2,
            purpose: "current_state",
          },
          {
            id: "sp3",
            text: "백악관 트럼프 관세 발표",
            rank: 3,
            purpose: "primary_source",
          },
          {
            id: "sp4",
            text: "트럼프 관세 발표 정정 업데이트",
            rank: 4,
            purpose: "contradiction_or_update",
          },
        ],
        domainRegistry: expect.arrayContaining([
          expect.objectContaining({
            id: "kr-centrist-yna",
          }),
        ]),
      }),
    );
  });

  it("분류 후보 제한은 첫 검색 쿼리 결과만 자르지 않고 쿼리별로 분산한다", async () => {
    const persistence = createPersistenceMock();
    const searchPlanQueries = [
      {
        id: "sp1",
        purpose: "check_specific",
        query: "한국은행 기준금리 동결",
        priority: 1,
      },
      {
        id: "sp2",
        purpose: "current_state",
        query: "한국은행 기준금리 최신",
        priority: 2,
      },
      {
        id: "sp3",
        purpose: "primary_source",
        query: "한국은행 기준금리 보도자료",
        priority: 3,
      },
      {
        id: "sp4",
        purpose: "contradiction_or_update",
        query: "한국은행 기준금리 동결 정정",
        priority: 4,
      },
    ] as const;
    const makeCandidate = (queryId: string, index: number) => ({
      id: `${queryId}-c${index}`,
      searchRoute: "supported",
      sourceProvider: "naver-search",
      sourceType: "news",
      publisherName: "연합뉴스",
      publishedAt: null,
      canonicalUrl: `https://www.yna.co.kr/view/${queryId}-${index}`,
      originalUrl: `https://www.yna.co.kr/view/${queryId}-${index}`,
      rawTitle: `${queryId} 기사 ${index}`,
      rawSnippet: `${queryId} 기사 ${index} 스니펫`,
      normalizedHash: `${queryId}-hash-${index}`,
      originQueryIds: [queryId],
      retrievalBucket: "familiar",
      domainRegistryId: null,
    });
    const initialCandidates = [
      ...Array.from({ length: 10 }, (_, index) => makeCandidate("sp1", index + 1)),
      makeCandidate("sp2", 1),
      makeCandidate("sp3", 1),
      makeCandidate("sp4", 1),
    ];
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "한국은행 기준금리 동결",
        normalizedCheck: "한국은행이 기준금리를 동결했다",
        checkType: "policy",
        isFactCheckQuestion: true,
        searchPlan: {
          queries: searchPlanQueries,
        },
        generatedQueries: [{ id: "q1", text: "한국은행 기준금리 동결", rank: 1 }],
        searchRoute: "supported",
        searchRouteReason: "한국 경제 뉴스 check입니다.",
      }),
      searchSources: jest.fn().mockResolvedValue(initialCandidates),
      classifyRelevanceAndEvidenceSignals: jest
        .fn()
        .mockImplementation(async ({ candidates }) => ({
          relevanceCandidates: candidates.map((candidate: Record<string, unknown>) => ({
            ...candidate,
            relevanceTier: "reference",
            relevanceReason: "검색 후보입니다.",
          })),
          evidenceSignals: [],
        })),
    } as unknown as AnswersProvidersService;
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: [],
      insufficiencyReason: null,
      evidenceSignals: [],
    });
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    await service.createQueryProcessingPreview("user-1", {
      check: "한국은행이 기준금리를 동결했다",
    });

    const candidates =
      (providers.classifyRelevanceAndEvidenceSignals as jest.Mock).mock.calls[0][0]
        .candidates;
    expect(candidates).toHaveLength(8);
    expect(candidates.map((candidate: { id: string }) => candidate.id)).toEqual([
      "sp1-c1",
      "sp2-c1",
      "sp3-c1",
      "sp4-c1",
      "sp1-c2",
      "sp1-c3",
      "sp1-c4",
      "sp1-c5",
    ]);
  });

  it("async preview는 검색 완료 직후 source를 먼저 반환하고 background 분류를 이어간다", async () => {
    const persistence = createPersistenceMock();
    const refinement = {
      coreCheck: "한국은행 기준금리 동결",
      normalizedCheck: "한국은행이 기준금리를 동결했다",
      checkType: "policy",
      isFactCheckQuestion: true,
      searchPlan: {
        queries: [
          {
            id: "sp1",
            purpose: "check_specific",
            query: "한국은행 기준금리 동결",
            priority: 1,
          },
        ],
      },
      generatedQueries: [{ id: "q1", text: "한국은행 기준금리 동결", rank: 1 }],
      searchRoute: "supported",
      searchRouteReason: "한국 경제 뉴스 check입니다.",
      };    const candidate = {
      id: "c1",
      sourceType: "news",
      publisherName: "연합뉴스",
      publishedAt: "2026-04-01T00:00:00.000Z",
      canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
      originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
      rawTitle: "한국은행 기준금리 동결",
      rawSnippet: "한국은행은 기준금리를 동결했다.",
      normalizedHash: "hash-1",
      originQueryIds: ["sp1"],
      retrievalBucket: "familiar",
      domainRegistryId: "kr-centrist-yna",
    };
    const createdSource = {
      id: "source-1",
      answerJobId: "answer-1",
      sourceProvider: "naver-search",
      sourceType: "news",
      publisherName: "연합뉴스",
      publishedAt: new Date("2026-04-01T00:00:00.000Z"),
      canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
      originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
      rawTitle: "한국은행 기준금리 동결",
      rawSnippet: "한국은행은 기준금리를 동결했다.",
      normalizedHash: "hash-1",
      fetchStatus: "pending",
      contentText: null,
      isDuplicate: false,
      duplicateGroupKey: null,
      originQueryIds: ["sp1"],
      relevanceTier: "reference",
      relevanceReason: "검색 결과 후보입니다. 근거 신호 분류가 진행 중입니다.",
      retrievalBucket: "familiar",
      domainRegistryId: null,
    };
    const providers = {
      refineQuery: jest.fn().mockResolvedValue(refinement),
      searchSources: jest.fn().mockResolvedValue([candidate]),
      classifyRelevanceAndEvidenceSignals: jest.fn().mockResolvedValue({
        relevanceCandidates: [
          {
            ...candidate,
            relevanceTier: "primary",
            relevanceReason: "check을 직접 다루는 기사입니다.",
          },
        ],
        evidenceSignals: [
          {
            sourceId: "c1",
            snippetId: null,
            stanceToCheck: "supports",
            temporalRole: "current_status",
            updateType: "confirmation",
            currentAnswerImpact: "strengthens",
            reason: "기준금리 동결을 확인합니다.",
          },
        ],
      }),
    } as unknown as AnswersProvidersService;
    persistence.persistSearchPreviewSources.mockResolvedValue([createdSource]);
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [createdSource],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: ["source-1"],
      insufficiencyReason: null,
      evidenceSignals: [],
    });
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreviewAsync("user-1", {
      check: "한국은행이 기준금리를 동결했다",
      clientRequestId: "pending:answer-1",
    });
    await flushPromises();

    expect(result.status).toBe("searching");
    expect(result.currentStage).toBe("relevance_and_signal_classification");
    expect(result.sources).toHaveLength(1);
    expect(result.result).toBeNull();
    expect(persistence.persistSearchPreviewSources).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            id: "c1",
            relevanceTier: "reference",
          }),
        ],
      }),
    );
    expect(persistence.persistQueryPreviewResult).toHaveBeenCalledWith(
      expect.objectContaining({
        existingSources: [createdSource],
        relevanceCandidates: [
          expect.objectContaining({
            id: "c1",
            relevanceTier: "primary",
          }),
        ],
      }),
    );
  });

  it("async background 분류 실패 시 failed로 기록하되 검색 source 저장은 유지한다", async () => {
    const persistence = createPersistenceMock();
    const loggerSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "한국은행 기준금리 동결",
        normalizedCheck: "한국은행이 기준금리를 동결했다",
        checkType: "policy",
        isFactCheckQuestion: true,
        searchPlan: {
          queries: [
            {
              id: "sp1",
              purpose: "check_specific",
              query: "한국은행 기준금리 동결",
              priority: 1,
            },
          ],
        },
        generatedQueries: [{ id: "q1", text: "한국은행 기준금리 동결", rank: 1 }],
        searchRoute: "supported",
        searchRouteReason: "한국 경제 뉴스 check입니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([
        {
          id: "c1",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: null,
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "한국은행 기준금리 동결",
          rawSnippet: "한국은행은 기준금리를 동결했다.",
          normalizedHash: "hash-1",
          originQueryIds: ["sp1"],
          retrievalBucket: "familiar",
          domainRegistryId: "kr-centrist-yna",
        },
      ]),
      classifyRelevanceAndEvidenceSignals: jest
        .fn()
        .mockRejectedValue(new Error("classification failed")),
    } as unknown as AnswersProvidersService;
    persistence.persistSearchPreviewSources.mockResolvedValue([
      {
        id: "source-1",
        sourceType: "news",
        publisherName: "연합뉴스",
        publishedAt: null,
        canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
        originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
        rawTitle: "한국은행 기준금리 동결",
        rawSnippet: "한국은행은 기준금리를 동결했다.",
        relevanceTier: "reference",
        relevanceReason: "검색 결과 후보입니다. 근거 신호 분류가 진행 중입니다.",
        originQueryIds: ["sp1"],
        retrievalBucket: "familiar",
      },
    ]);
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    await service.createQueryProcessingPreviewAsync("user-1", {
      check: "한국은행이 기준금리를 동결했다",
    });
    await flushPromises();

    expect(persistence.persistSearchPreviewSources).toHaveBeenCalledTimes(1);
    expect(persistence.markAnswerJobFailed).toHaveBeenCalledWith(
      "answer-1",
      expect.any(Error),
    );
    loggerSpy.mockRestore();
  });

  it("async preview는 같은 clientRequestId의 진행 중 answer를 중복 생성하지 않는다", async () => {
    const persistence = createPersistenceMock();
    persistence.findQueryProcessingPreviewByClientRequestId.mockResolvedValue({
      id: "answer-1",
      clientRequestId: "pending:answer-1",
      status: "searching",
      currentStage: "relevance_and_signal_classification",
      searchedSourceCount: 1,
      lastErrorCode: null,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      check: {
        id: "check-1",
        rawText: "한국은행이 기준금리를 동결했다",
        normalizedText: "한국은행이 기준금리를 동결했다",
      },
      queryRefinement: null,
      handoffPayload: null,
      sources: [],
      evidenceSnippets: [],
    });
    const service = new AnswersQueryPreviewService(
      persistence as never,
      {} as never,
    );

    const result = await service.createQueryProcessingPreviewAsync("user-1", {
      check: "한국은행이 기준금리를 동결했다",
      clientRequestId: "pending:answer-1",
    });

    expect(result.answerId).toBe("answer-1");
    expect(persistence.createCheckAndAnswerJob).not.toHaveBeenCalled();
    expect(persistence.resetQueryProcessingPreview).not.toHaveBeenCalled();
    expect(persistence.persistSearchPreviewSources).not.toHaveBeenCalled();
  });

  it("해외뉴스 check은 out_of_scope로 저장하고 source 수집을 건너뛴다", async () => {
    const persistence = createPersistenceMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "트럼프의 관세 발표",
        normalizedCheck: "트럼프가 관세를 발표했다",
        checkType: "policy",
        isFactCheckQuestion: true,
        searchPlan: {
          queries: [
            {
              id: "sp1",
              purpose: "check_specific",
              query: "Trump tariff announcement",
              priority: 1,
            },
            {
              id: "sp2",
              purpose: "current_state",
              query: "Trump tariffs latest news",
              priority: 2,
            },
            {
              id: "sp3",
              purpose: "primary_source",
              query: "White House Trump tariff announcement",
              priority: 3,
            },
            {
              id: "sp4",
              purpose: "contradiction_or_update",
              query: "Trump tariff announcement update correction",
              priority: 4,
            },
          ],
        },
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "미국 관세 정책 발표", rank: 2 },
          { id: "q3", text: "트럼프 관세 업데이트", rank: 3 },
        ],
        searchRoute: "unsupported",
        searchRouteReason:
          "VARO는 현재 한국뉴스만 분석하므로 해외 뉴스 check은 지원 범위 밖입니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as AnswersProvidersService;
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      check: "트럼프가 오늘 관세 발표했대",
    });

    expect(result.status).toBe("out_of_scope");
    expect(result.generatedQueries).toEqual([
      { id: "q1", text: "트럼프 관세 발표", rank: 1 },
      { id: "q2", text: "미국 관세 정책 발표", rank: 2 },
      { id: "q3", text: "트럼프 관세 업데이트", rank: 3 },
    ]);
    expect(providers.searchSources).not.toHaveBeenCalled();
    expect(persistence.persistOutOfScopeAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        refinement: expect.objectContaining({
          searchRoute: "unsupported",
        }),
      }),
    );
  });

  it("같은 clientRequestId로 다시 호출하면 같은 answerId를 재사용한다", async () => {
    const persistence = createPersistenceMock();
    persistence.findQueryProcessingPreviewByClientRequestId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "answer-1",
        clientRequestId: "pending:answer-1",
        status: "partial",
        currentStage: "handoff_ready",
        searchedSourceCount: 1,
        lastErrorCode: null,
        createdAt: new Date("2026-04-01T02:00:00.000Z"),
        check: {
          id: "check-1",
          rawText: "트럼프가 오늘 관세 발표했대",
          normalizedText: "트럼프가 오늘 관세 발표했대",
        },
        queryRefinement: {
          coreCheck: "트럼프의 관세 발표",
          generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        },
        handoffPayload: {
          coreCheck: "트럼프의 관세 발표",
          sourceIds: [],
          snippetIds: [],
          insufficiencyReason: null,
        },
        sources: [],
        evidenceSnippets: [],
      });
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: [],
      insufficiencyReason: "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    });
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      classifyRelevanceAndEvidenceSignals: jest.fn().mockResolvedValue({
        relevanceCandidates: [],
        evidenceSignals: [],
      }),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as AnswersProvidersService;
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const firstResult = await service.createQueryProcessingPreview("user-1", {
      check: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:answer-1",
    });
    const secondResult = await service.createQueryProcessingPreview("user-1", {
      check: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:answer-1",
    });

    expect(firstResult.answerId).toBe("answer-1");
    expect(secondResult.answerId).toBe("answer-1");
    expect(firstResult.clientRequestId).toBe("pending:answer-1");
    expect(secondResult.clientRequestId).toBe("pending:answer-1");
    expect(persistence.createCheckAndAnswerJob).toHaveBeenCalledTimes(1);
    expect(persistence.resetQueryProcessingPreview).not.toHaveBeenCalled();
  });

  it("같은 clientRequestId의 searching answer는 초기화 후 같은 answerId로 재실행한다", async () => {
    const persistence = createPersistenceMock();
    persistence.findQueryProcessingPreviewByClientRequestId.mockResolvedValue({
      id: "answer-1",
      clientRequestId: "pending:answer-1",
      status: "searching",
      currentStage: "query_refinement",
      searchedSourceCount: 0,
      lastErrorCode: null,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      check: {
        id: "check-1",
        rawText: "트럼프가 오늘 관세 발표했대",
        normalizedText: "트럼프가 오늘 관세 발표했대",
      },
      queryRefinement: null,
      handoffPayload: null,
      sources: [],
      evidenceSnippets: [],
    });
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: [],
      insufficiencyReason: "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    });
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      classifyRelevanceAndEvidenceSignals: jest.fn().mockResolvedValue({
        relevanceCandidates: [],
        evidenceSignals: [],
      }),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as AnswersProvidersService;
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      check: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:answer-1",
    });

    expect(result.answerId).toBe("answer-1");
    expect(result.clientRequestId).toBe("pending:answer-1");
    expect(persistence.createCheckAndAnswerJob).not.toHaveBeenCalled();
    expect(persistence.resetQueryProcessingPreview).toHaveBeenCalledWith("answer-1");
  });

  it("같은 clientRequestId의 failed answer는 초기화 후 같은 answerId로 재실행한다", async () => {
    const persistence = createPersistenceMock();
    persistence.findQueryProcessingPreviewByClientRequestId.mockResolvedValue({
      id: "answer-1",
      clientRequestId: "pending:answer-1",
      status: "failed",
      currentStage: "failed",
      searchedSourceCount: 0,
      lastErrorCode: APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      check: {
        id: "check-1",
        rawText: "트럼프가 오늘 관세 발표했대",
        normalizedText: "트럼프가 오늘 관세 발표했대",
      },
      queryRefinement: null,
      handoffPayload: null,
      sources: [],
      evidenceSnippets: [],
    });
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: [],
      insufficiencyReason: "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    });
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      classifyRelevanceAndEvidenceSignals: jest.fn().mockResolvedValue({
        relevanceCandidates: [],
        evidenceSignals: [],
      }),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as AnswersProvidersService;
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      check: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:answer-1",
    });

    expect(result.answerId).toBe("answer-1");
    expect(result.clientRequestId).toBe("pending:answer-1");
    expect(persistence.createCheckAndAnswerJob).not.toHaveBeenCalled();
    expect(persistence.resetQueryProcessingPreview).toHaveBeenCalledWith("answer-1");
    expect(providers.refineQuery).toHaveBeenCalledTimes(1);
  });

  it("저장된 answer preview 목록을 summary 응답으로 매핑한다", async () => {
    const persistence = createPersistenceMock();
    persistence.listRecentQueryProcessingPreviews.mockResolvedValue([
      {
        id: "answer-1",
        clientRequestId: "pending:answer-1",
        status: "partial",
        currentStage: "handoff_ready",
        lastErrorCode: null,
        createdAt: new Date("2026-04-01T02:00:00.000Z"),
        check: {
          rawText: "트럼프가 오늘 관세 발표했대",
        },
        sources: [{ fetchStatus: "fetched" }, { fetchStatus: "pending" }],
      },
    ]);
    const service = new AnswersQueryPreviewService(
      persistence as never,
      {} as never,
    );

    const result = await service.listQueryProcessingPreviews("user-1");

    expect(result).toEqual([
      {
        answerId: "answer-1",
        clientRequestId: "pending:answer-1",
        rawCheck: "트럼프가 오늘 관세 발표했대",
        status: "partial",
        currentStage: "handoff_ready",
        createdAt: "2026-04-01T02:00:00.000Z",
        selectedSourceCount: 1,
        lastErrorCode: null,
      },
    ]);
  });

  it("저장된 answer preview 상세를 응답 DTO로 매핑한다", async () => {
    const persistence = createPersistenceMock();
    persistence.getQueryProcessingPreview.mockResolvedValue({
      id: "answer-1",
      clientRequestId: "pending:answer-1",
      status: "partial",
      currentStage: "handoff_ready",
      searchedSourceCount: 2,
      lastErrorCode: null,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      check: {
        id: "check-1",
        rawText: "트럼프가 오늘 관세 발표했대",
        normalizedText: "트럼프가 오늘 관세 발표했대",
      },
      queryRefinement: {
        coreCheck: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
      },
      handoffPayload: {
        coreCheck: "트럼프의 관세 발표",
        sourceIds: ["source-2"],
        snippetIds: ["snippet-1"],
        insufficiencyReason: null,
      },
      sources: [
        {
          id: "source-2",
          answerJobId: "answer-1",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: new Date("2026-04-01T01:00:00.000Z"),
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          normalizedHash: "hash-2",
          fetchStatus: "fetched",
          contentText: "추출 본문",
          isDuplicate: false,
          duplicateGroupKey: null,
          originQueryIds: ["q1"],
          relevanceTier: "primary",
          relevanceReason: "원문 검증 source입니다.",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
        },
      ],
      evidenceSnippets: [
        {
          id: "snippet-1",
          answerJobId: "answer-1",
          sourceId: "source-2",
          snippetText: "추출 snippet",
          stance: "neutral",
          startOffset: null,
          endOffset: null,
        },
      ],
    });
    const service = new AnswersQueryPreviewService(
      persistence as never,
      {} as never,
    );

    const result = await service.getQueryProcessingPreview("user-1", "answer-1");

    expect(result.answerId).toBe("answer-1");
    expect(result.evidenceSnippets[0]?.evidenceSummary).toBe("원문 검증 source입니다.");
    expect(result.clientRequestId).toBe("pending:answer-1");
    expect(result.rawCheck).toBe("트럼프가 오늘 관세 발표했대");
    expect(result.sources[0]?.originalUrl).toBe(
      "https://www.reuters.com/world/us/trump-tariff-update",
    );
    expect(result.sources[0]?.publishedAt).toBe("2026-04-01T01:00:00.000Z");
    expect(result.sources[0]?.stance).toBe("support");
    expect(result.handoff.sourceIds).toEqual(["source-2"]);
    expect(result.result?.mode).toBe("rule_based_preview");
    expect(result.result?.verdict).toBe("Unclear");
  });

  it("unsupported route면 out_of_scope로 저장하고 source 수집을 건너뛴다", async () => {
    const persistence = createPersistenceMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "트럼프의 관세 발표",
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "미국 관세 정책", rank: 2 },
          { id: "q3", text: "Trump tariff", rank: 3 },
        ],
        searchRoute: "unsupported",
        searchRouteReason: "기사/공식 발표 검색만으로 검토하기 어려운 요청입니다.",
      }),
      searchSources: jest.fn(),
      searchFallbackSources: jest.fn(),
      extractContent: jest.fn(),
    } as unknown as AnswersProvidersService;
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      check: "트럼프가 오늘 관세 발표했대",
    });

    expect(result.status).toBe("out_of_scope");
    expect(result.currentStage).toBe("scope_checked");
    expect(result.result).toBeNull();
    expect(result.sources).toEqual([]);
    expect(persistence.persistOutOfScopeAnswer).toHaveBeenCalledWith({
      userId: "user-1",
      answerJob: expect.objectContaining({ id: "answer-1" }),
      refinement: expect.objectContaining({
        searchRoute: "unsupported",
      }),
      generatedQueries: [
        { id: "q1", text: "트럼프 관세 발표", rank: 1 },
        { id: "q2", text: "미국 관세 정책", rank: 2 },
        { id: "q3", text: "Trump tariff", rank: 3 },
      ],
    });
    expect(providers.searchSources).not.toHaveBeenCalled();
    expect(
      (providers as unknown as { searchFallbackSources: jest.Mock }).searchFallbackSources,
    ).not.toHaveBeenCalled();
    expect(providers.extractContent).not.toHaveBeenCalled();
  });

  it("isFactCheckQuestion false면 out_of_scope가 아니라 Perplexity 직접 답변으로 저장한다", async () => {
    const persistence = createPersistenceMock();
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [
        {
          id: "source-1",
          sourceType: "other",
          publisherName: "example.com",
          publishedAt: null,
          canonicalUrl: "https://example.com/answer",
          originalUrl: "https://example.com/answer",
          rawTitle: "참고 출처",
          rawSnippet: "직접 답변 참고 링크입니다.",
          originQueryIds: ["q1"],
          relevanceTier: "primary",
          relevanceReason: "Perplexity sonar 실시간 검색 인용 출처",
          retrievalBucket: "familiar",
          domainRegistryId: null,
          fetchStatus: "pending",
          contentText: null,
        },
      ],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: ["source-1"],
      insufficiencyReason: "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
      evidenceSignals: [],
      answerSummary: {
        analysisSummary: "정치 뉴스는 여러 출처를 비교해 읽는 것이 좋습니다.",
        uncertaintySummary:
          "Perplexity 직접 답변입니다. 출처 기반 사실성 검토 결과가 아닙니다.",
        uncertaintyItems: [],
      },
    });
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "정치 뉴스 읽는 방법",
        normalizedCheck: "정치 뉴스를 어떻게 읽어야 하는지 묻는 질문",
        checkType: "general_fact",
        isFactCheckQuestion: false,
        searchPlan: { queries: [] },
        generatedQueries: [{ id: "q1", text: "정치 뉴스 읽는 방법", rank: 1 }],
        searchRoute: "unsupported",
        searchRouteReason: "출처 기반 사실성 검토 대상이 아닙니다.",
      }),
      answerDirectly: jest.fn().mockResolvedValue({
        answerText: "정치 뉴스는 여러 출처를 비교해 읽는 것이 좋습니다.",
        citations: [{ url: "https://example.com/answer" }],
      }),
      searchSources: jest.fn(),
      extractContent: jest.fn(),
    } as unknown as AnswersProvidersService;
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      check: "정치 뉴스는 어떻게 읽는 게 좋아?",
    });

    expect(result.status).toBe("partial");
    expect(result.isFactCheckQuestion).toBe(false);
    expect(result.result?.analysisSummary).toContain("정치 뉴스");
    expect(providers.answerDirectly).toHaveBeenCalledWith("정치 뉴스 읽는 방법");
    expect(providers.searchSources).not.toHaveBeenCalled();
    expect(persistence.persistOutOfScopeAnswer).not.toHaveBeenCalled();
  });

  it("verification source가 부족해도 domainless fallback search를 수행하지 않는다", async () => {
    const persistence = createPersistenceMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        coreCheck: "트럼프의 관세 발표",
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "Trump tariff announcement", rank: 2 },
          { id: "q3", text: "미국 관세 정책 발표", rank: 3 },
        ],
      }),
      searchSources: jest.fn().mockResolvedValue([
        {
          id: "c1",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: null,
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "트럼프 관세 발표 관련 한국 보도",
          rawSnippet: "국내 종합 기사입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
      ]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      classifyRelevanceAndEvidenceSignals: jest
        .fn()
        .mockResolvedValueOnce({
          relevanceCandidates: [
            {
              id: "c1",
              sourceType: "news",
              publisherName: "연합뉴스",
              publishedAt: null,
              canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
              originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
              rawTitle: "트럼프 관세 발표 관련 한국 보도",
              rawSnippet: "국내 종합 기사입니다.",
              normalizedHash: "hash-1",
              originQueryIds: ["q1"],
              retrievalBucket: "familiar",
              domainRegistryId: "kr-familiar",
              relevanceTier: "reference",
              relevanceReason: "보조 근거입니다.",
            },
          ],
          evidenceSignals: [],
        }),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as AnswersProvidersService;
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [
        {
          id: "source-1",
          sourceType: "news",
          publisherName: "연합뉴스",
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "트럼프 관세 발표 관련 한국 보도",
          rawSnippet: "국내 종합 기사입니다.",
          relevanceTier: "reference",
          relevanceReason: "보조 근거입니다.",
          originQueryIds: ["q1"],
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
      ],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: [],
      insufficiencyReason:
        "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    });
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      check: "트럼프가 오늘 관세 발표했대",
    });

    expect(
      (providers as unknown as { searchFallbackSources: jest.Mock }).searchFallbackSources,
    ).not.toHaveBeenCalled();
    expect(result.sources.some((source) => source.retrievalBucket === "fallback")).toBe(false);
  });

  it("refinement가 실패해도 check은 남기고 answer job을 failed로 기록한다", async () => {
    const persistence = createPersistenceMock();
    const loggerSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const error = new AppException(
      APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      "질의 정제 결과가 요구 형식을 충족하지 않습니다.",
      HttpStatus.BAD_GATEWAY,
    );
    const providers = {
      refineQuery: jest.fn().mockRejectedValue(error),
    } as unknown as AnswersProvidersService;
    const service = new AnswersQueryPreviewService(
      persistence as never,
      providers,
    );

    await expect(
      service.createQueryProcessingPreview("user-1", {
        check: "테슬라가 한국에서 완전 철수한대",
        clientRequestId: "pending:answer-1",
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      status: HttpStatus.BAD_GATEWAY,
    });

    expect(persistence.createCheckAndAnswerJob).toHaveBeenCalledTimes(1);
    expect(persistence.markAnswerJobFailed).toHaveBeenCalledWith("answer-1", error);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "answer query processing preview failed userId=user-1 answerJobId=answer-1 checkId=check-1 clientRequestId=pending:answer-1 errorCode=LLM_SCHEMA_ERROR",
      ),
      expect.any(String),
    );
    expect(loggerSpy.mock.calls[0]?.[0]).not.toContain("테슬라가 한국에서 완전 철수한대");
    loggerSpy.mockRestore();
  });

  it("reopen 요청을 history entry로 기록한다", async () => {
    const persistence = createPersistenceMock();
    const service = new AnswersQueryPreviewService(
      persistence as never,
      {} as never,
    );

    await service.recordAnswerReopen("user-1", "answer-1");

    expect(persistence.ensureReopenableAnswer).toHaveBeenCalledWith("answer-1");
    expect(persistence.recordHistoryEntry).toHaveBeenCalledWith({
      userId: "user-1",
      answerJobId: "answer-1",
      entryType: "reopened",
    });
  });

  it("answer 삭제 요청을 persistence에 위임한다", async () => {
    const persistence = createPersistenceMock();
    const service = new AnswersQueryPreviewService(
      persistence as never,
      {} as never,
    );

    await service.deleteQueryProcessingPreview("user-1", "answer-1");

    expect(persistence.deleteQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      "answer-1",
    );
  });
});
