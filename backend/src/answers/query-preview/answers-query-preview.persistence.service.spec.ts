import { Prisma } from "@prisma/client";
import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { AnswersQueryPreviewPersistenceService } from "./answers-query-preview.persistence.service";

describe("AnswersQueryPreviewPersistenceService", () => {
  const createNotificationsServiceMock = () => ({
    createAnswerCompletedNotification: jest.fn().mockResolvedValue(undefined),
  });

  const createPrismaMock = () => ({
    check: {
      create: jest.fn().mockResolvedValue({
        id: "check-1",
        rawText: "트럼프가 오늘 관세 발표했대",
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    answerJob: {
      create: jest.fn().mockResolvedValue({
        id: "answer-1",
        createdAt: new Date("2026-04-01T02:00:00.000Z"),
        clientRequestId: "pending:answer-1",
      }),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({
        id: "answer-1",
        handoffPayload: {
          sourceIds: ["source-1"],
        },
      }),
    },
    source: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: `${String(data.canonicalUrl).split("/").pop()}`,
            ...data,
          }),
        ),
      update: jest
        .fn()
        .mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) =>
            Promise.resolve({
              id: where.id,
              ...data,
            }),
        ),
    },
    evidenceSnippet: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: `snippet-${String(data.sourceId)}`,
            ...data,
          }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(data),
        ),
    },
    userProfile: {
      findUnique: jest.fn().mockResolvedValue({
        country: "KR",
      }),
    },
    sourceDomainRegistry: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      upsert: jest.fn().mockResolvedValue({
        id: "preview-user-1",
      }),
    },
    userHistory: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    notification: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  });

  it("clientRequestId를 포함해 check과 answer job을 생성한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.createCheckAndAnswerJob({
      userId: "user-1",
      rawCheck: "트럼프가 오늘 관세 발표했대",
      normalizedCheck: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:answer-1",
    });

    expect(prisma.answerJob.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        checkId: "check-1",
        clientRequestId: "pending:answer-1",
        status: "searching",
        currentStage: "query_refinement",
      },
      select: {
        id: true,
        createdAt: true,
        clientRequestId: true,
      },
    });
    expect(result.answerJob.id).toBe("answer-1");
    expect(result.answerJob.clientRequestId).toBe("pending:answer-1");
  });

  it("clientRequestId로 기존 answer preview를 조회한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.findQueryProcessingPreviewByClientRequestId(
      "user-1",
      "pending:answer-1",
    );

    expect(prisma.answerJob.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        clientRequestId: "pending:answer-1",
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
  });

  it("searching answer를 재실행하기 전에 artifact와 집계 상태를 초기화한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.resetQueryProcessingPreview("answer-1");

    expect(prisma.evidenceSnippet.deleteMany).toHaveBeenCalledWith({
      where: {
        answerJobId: "answer-1",
      },
    });
    expect(prisma.source.deleteMany).toHaveBeenCalledWith({
      where: {
        answerJobId: "answer-1",
      },
    });
    expect(prisma.answerJob.update).toHaveBeenCalledWith({
      where: { id: "answer-1" },
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
  });

  it("검색 완료 직후 source를 저장하고 signal 분류 진행 상태로 갱신한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.persistSearchPreviewSources({
      answerJob: { id: "answer-1" },
      refinement: {
        coreCheck: "한국은행 기준금리 동결",
        normalizedCheck: "한국은행이 기준금리를 동결했다",
        checkType: "policy",
        answerMode: "fact_check",
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
      },
      generatedQueries: [{ id: "q1", text: "한국은행 기준금리 동결", rank: 1 }],
      candidates: [
        {
          id: "c1",
          searchRoute: "supported",
          sourceProvider: "naver-search",
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
          domainRegistryId: null,
          relevanceTier: "reference",
          relevanceReason: "검색 결과 후보입니다.",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(prisma.answerJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "answer-1" },
        data: expect.objectContaining({
          status: "searching",
          currentStage: "relevance_and_signal_classification",
          searchedSourceCount: 1,
          handoffPayload: Prisma.DbNull,
        }),
      }),
    );
    expect(notificationsService.createAnswerCompletedNotification).not.toHaveBeenCalled();
  });

  it("source와 evidence를 저장하고 answer job handoff 상태를 업데이트한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.persistQueryPreviewResult({
      userId: "user-1",
      answerJob: { id: "answer-1" },
      refinement: {
        coreCheck: "트럼프의 관세 발표",
        normalizedCheck: "트럼프가 관세를 발표했다",
        checkType: "policy",
        answerMode: "fact_check",
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
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        searchRoute: "unsupported",
        searchRouteReason: "미국 정책 발표를 다루는 해외 뉴스성 check입니다.",
      },
      generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
      relevanceCandidates: [
        {
          id: "c1",
          searchRoute: "unsupported",
          sourceProvider: "tavily-search",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: null,
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          retrievalBucket: "verification",
          domainRegistryId: null,
          sourcePoliticalLean: "centrist",
          relevanceTier: "primary",
          relevanceReason: "원문 검증 source입니다.",
        },
      ],
      evidenceSignals: [
        {
          sourceId: "c1",
          snippetId: null,
          stanceToCheck: "updates",
          temporalRole: "latest_update",
          updateType: "delay",
          currentAnswerImpact: "overrides",
          reason: "최근 업데이트 보도입니다.",
        },
      ],
      primaryExtractionLimit: 5,
    });

    expect(prisma.source.create).toHaveBeenCalledTimes(1);
    expect(prisma.source.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceProvider: "tavily-search",
      }),
    });
    expect(prisma.evidenceSnippet.create).not.toHaveBeenCalled();
    expect(prisma.evidenceSnippet.update).not.toHaveBeenCalled();
    expect(prisma.answerJob.update).toHaveBeenCalledWith({
      where: { id: "answer-1" },
      data: expect.objectContaining({
        status: "partial",
        currentStage: "handoff_ready",
        searchedSourceCount: 1,
        processedSourceCount: 0,
        queryRefinement: expect.objectContaining({
          searchRoute: "unsupported",
          searchProvider: null,
          normalizedCheck: "트럼프가 관세를 발표했다",
          checkType: "policy",
          searchPlan: expect.objectContaining({
            queries: expect.arrayContaining([
              expect.objectContaining({
                purpose: "current_state",
                query: "Trump tariffs latest news",
              }),
            ]),
          }),
        }),
        handoffPayload: expect.objectContaining({
          sourcePoliticalLeans: {
            "trump-tariff-update": "centrist",
          },
          evidenceSignals: [
            expect.objectContaining({
              sourceId: "trump-tariff-update",
              snippetId: null,
              currentAnswerImpact: "overrides",
            }),
          ],
        }),
        lastErrorCode: null,
      }),
    });
    expect(prisma.userHistory.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        answerJobId: "answer-1",
        entryType: "submitted",
      },
    });
    expect(notificationsService.createAnswerCompletedNotification).toHaveBeenCalledWith({
      userId: "user-1",
      answerId: "answer-1",
      check: "트럼프의 관세 발표",
    });
    expect(result.handoffSourceIds).toEqual(["trump-tariff-update"]);
    expect(result.evidenceSnippets).toEqual([]);
    expect(result.evidenceSignals[0]?.sourceId).toBe("trump-tariff-update");
  });

  it("app exception을 answer job failed 상태로 기록한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );
    const error = new AppException(
      APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      "질의 정제 실패",
      HttpStatus.BAD_GATEWAY,
    );

    await service.markAnswerJobFailed("answer-1", error);

    expect(prisma.answerJob.update).toHaveBeenCalledWith({
      where: { id: "answer-1" },
      data: {
        status: "failed",
        currentStage: "failed",
        lastErrorCode: APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      },
    });
  });

  it("unsupported route answer를 out_of_scope 상태로 기록한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.persistOutOfScopeAnswer({
      userId: "user-1",
      answerJob: { id: "answer-1" },
      refinement: {
        coreCheck: "트럼프의 관세 발표",
        normalizedCheck: "트럼프가 관세를 발표했다",
        checkType: "policy",
        answerMode: "fact_check",
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
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        searchRoute: "unsupported",
        searchRouteReason: "기사/공식 발표 검색만으로 검토하기 어려운 요청입니다.",
      },
      generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
    });

    expect(prisma.answerJob.update).toHaveBeenCalledWith({
      where: { id: "answer-1" },
      data: expect.objectContaining({
        status: "out_of_scope",
        currentStage: "scope_checked",
        searchedSourceCount: 0,
        processedSourceCount: 0,
        lastErrorCode: null,
      }),
    });
    expect(prisma.userHistory.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        answerJobId: "answer-1",
        entryType: "submitted",
      },
    });
    expect(notificationsService.createAnswerCompletedNotification).toHaveBeenCalledWith({
      userId: "user-1",
      answerId: "answer-1",
      check: "트럼프의 관세 발표",
    });
    expect(result.insufficiencyReason).toContain("지원 범위 밖");
  });

  it("사용자 기준 최근 answer preview 목록을 조회한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    prisma.answerJob.findMany.mockResolvedValue([
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
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.listRecentQueryProcessingPreviews("user-1");

    expect(prisma.answerJob.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
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
    expect(result).toHaveLength(1);
    expect(result[0]?.clientRequestId).toBe("pending:answer-1");
  });

  it("로그인 사용자가 접근 가능한 answer preview 상세를 조회한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    prisma.answerJob.findFirst.mockResolvedValue({
      id: "answer-404",
      clientRequestId: "pending:answer-404",
      status: "partial",
      currentStage: "handoff_ready",
      lastErrorCode: null,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      check: {
        id: "check-1",
        rawText: "트럼프가 오늘 관세 발표했대",
        normalizedText: "트럼프가 오늘 관세 발표했대",
      },
      sources: [],
      evidenceSnippets: [],
    });
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.getQueryProcessingPreview("user-2", "answer-404");

    expect(result).toMatchObject({
      id: "answer-404",
      clientRequestId: "pending:answer-404",
    });
    expect(prisma.answerJob.findFirst).toHaveBeenCalledWith({
      where: {
        id: "answer-404",
        userId: "user-2",
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
  });

  it("다른 사용자의 answerId는 404를 반환한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    prisma.answerJob.findFirst.mockResolvedValue(null);
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await expect(
      service.getQueryProcessingPreview("user-2", "answer-404"),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: APP_ERROR_CODES.NOT_FOUND,
    });
  });

  it("answer와 연결된 알림을 삭제하고 orphan check을 정리한다", async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    prisma.answerJob.findFirst.mockResolvedValue({
      id: "answer-1",
      checkId: "check-1",
    });
    prisma.answerJob.count.mockResolvedValue(0);
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.deleteQueryProcessingPreview("user-1", "answer-1");

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        targetType: "answer",
        targetId: "answer-1",
      },
    });
    expect(prisma.answerJob.delete).toHaveBeenCalledWith({
      where: {
        id: "answer-1",
      },
    });
    expect(prisma.check.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "check-1",
      },
    });
  });

  it("같은 check의 다른 answer가 남아 있으면 check은 유지한다", async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    prisma.answerJob.findFirst.mockResolvedValue({
      id: "answer-1",
      checkId: "check-1",
    });
    prisma.answerJob.count.mockResolvedValue(1);
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.deleteQueryProcessingPreview("user-1", "answer-1");

    expect(prisma.check.deleteMany).not.toHaveBeenCalled();
  });

  it("본인 소유가 아닌 answer 삭제는 404를 반환한다", async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    prisma.answerJob.findFirst.mockResolvedValue(null);
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await expect(
      service.deleteQueryProcessingPreview("user-1", "answer-404"),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: APP_ERROR_CODES.NOT_FOUND,
    });
  });

  it("reopen history entry를 저장한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.recordHistoryEntry({
      userId: "user-1",
      answerJobId: "answer-1",
      entryType: "reopened",
    });

    expect(prisma.userHistory.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        answerJobId: "answer-1",
        entryType: "reopened",
      },
    });
  });

  it("handoff가 없는 answer는 reopen 대상에서 제외한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    prisma.answerJob.findUnique.mockResolvedValue({
      id: "answer-404",
      handoffPayload: null,
    });
    const service = new AnswersQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await expect(service.ensureReopenableAnswer("answer-404")).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: APP_ERROR_CODES.NOT_FOUND,
    });
  });
});
