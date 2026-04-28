import { Prisma } from "@prisma/client";
import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { ReviewsQueryPreviewPersistenceService } from "./reviews-query-preview.persistence.service";

describe("ReviewsQueryPreviewPersistenceService", () => {
  const createNotificationsServiceMock = () => ({
    createReviewCompletedNotification: jest.fn().mockResolvedValue(undefined),
  });

  const createPrismaMock = () => ({
    claim: {
      create: jest.fn().mockResolvedValue({
        id: "claim-1",
        rawText: "트럼프가 오늘 관세 발표했대",
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    reviewJob: {
      create: jest.fn().mockResolvedValue({
        id: "review-1",
        createdAt: new Date("2026-04-01T02:00:00.000Z"),
        clientRequestId: "pending:review-1",
      }),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({
        id: "review-1",
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

  it("clientRequestId를 포함해 claim과 review job을 생성한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.createClaimAndReviewJob({
      userId: "user-1",
      rawClaim: "트럼프가 오늘 관세 발표했대",
      normalizedClaim: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:review-1",
    });

    expect(prisma.reviewJob.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        claimId: "claim-1",
        clientRequestId: "pending:review-1",
        status: "searching",
        currentStage: "query_refinement",
      },
      select: {
        id: true,
        createdAt: true,
        clientRequestId: true,
      },
    });
    expect(result.reviewJob.id).toBe("review-1");
    expect(result.reviewJob.clientRequestId).toBe("pending:review-1");
  });

  it("clientRequestId로 기존 review preview를 조회한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.findQueryProcessingPreviewByClientRequestId(
      "user-1",
      "pending:review-1",
    );

    expect(prisma.reviewJob.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        clientRequestId: "pending:review-1",
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
  });

  it("searching review를 재실행하기 전에 artifact와 집계 상태를 초기화한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.resetQueryProcessingPreview("review-1");

    expect(prisma.evidenceSnippet.deleteMany).toHaveBeenCalledWith({
      where: {
        reviewJobId: "review-1",
      },
    });
    expect(prisma.source.deleteMany).toHaveBeenCalledWith({
      where: {
        reviewJobId: "review-1",
      },
    });
    expect(prisma.reviewJob.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
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

  it("source와 evidence를 저장하고 review job handoff 상태를 업데이트한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.persistQueryPreviewResult({
      userId: "user-1",
      reviewJob: { id: "review-1" },
      refinement: {
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        normalizedClaim: "트럼프가 관세를 발표했다",
        claimType: "policy",
        verificationGoal:
          "현재 수집 가능한 출처 기준으로 트럼프의 관세 발표 여부와 최신 상태를 확인한다.",
        searchPlan: {
          normalizedClaim: "트럼프가 관세를 발표했다",
          claimType: "policy",
          verificationGoal:
            "현재 수집 가능한 출처 기준으로 트럼프의 관세 발표 여부와 최신 상태를 확인한다.",
          searchRoute: "global_news",
          queries: [
            {
              id: "sp1",
              purpose: "claim_specific",
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
        searchRoute: "global_news",
        searchRouteReason: "미국 정책 발표를 다루는 해외 뉴스성 claim입니다.",
        searchClaim: "Trump tariff announcement",
        searchQueries: [{ id: "q1", text: "Trump tariff announcement", rank: 1 }],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: true,
        koreaRelevanceReason: "한국 시장에 대한 직접 영향이 포함되어 있습니다.",
      },
      generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
      userCountryCode: "KR",
      relevanceCandidates: [
        {
          id: "c1",
          searchRoute: "global_news",
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
          sourceCountryCode: "US",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
          sourcePoliticalLean: "centrist",
          relevanceTier: "primary",
          relevanceReason: "원문 검증 source입니다.",
        },
      ],
      extractionTargets: [
        {
          id: "c1",
          searchRoute: "global_news",
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
          sourceCountryCode: "US",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
          sourcePoliticalLean: "centrist",
          relevanceTier: "primary",
          relevanceReason: "원문 검증 source입니다.",
        },
      ],
      extractedSources: [
        {
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          contentText: "추출 본문",
          snippetText: "추출 snippet",
        },
      ],
      evidenceSignals: [
        {
          sourceId: "c1",
          snippetId: null,
          stanceToClaim: "updates",
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
    expect(prisma.evidenceSnippet.create).toHaveBeenCalledTimes(1);
    expect(prisma.evidenceSnippet.update).toHaveBeenCalledWith({
      where: { id: "snippet-trump-tariff-update" },
      data: { stance: "conflict" },
    });
    expect(prisma.reviewJob.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
      data: expect.objectContaining({
        status: "partial",
        currentStage: "handoff_ready",
        searchedSourceCount: 1,
        processedSourceCount: 1,
        queryRefinement: expect.objectContaining({
          searchRoute: "global_news",
          searchProvider: "tavily-search",
          searchClaim: "Trump tariff announcement",
          normalizedClaim: "트럼프가 관세를 발표했다",
          claimType: "policy",
          verificationGoal:
            "현재 수집 가능한 출처 기준으로 트럼프의 관세 발표 여부와 최신 상태를 확인한다.",
          searchPlan: expect.objectContaining({
            searchRoute: "global_news",
            queries: expect.arrayContaining([
              expect.objectContaining({
                purpose: "current_state",
                query: "Trump tariffs latest news",
              }),
            ]),
          }),
          searchQueries: [{ id: "q1", text: "Trump tariff announcement", rank: 1 }],
        }),
        handoffPayload: expect.objectContaining({
          sourcePoliticalLeans: {
            "trump-tariff-update": "centrist",
          },
          evidenceSignals: [
            expect.objectContaining({
              sourceId: "trump-tariff-update",
              snippetId: "snippet-trump-tariff-update",
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
        reviewJobId: "review-1",
        entryType: "submitted",
      },
    });
    expect(notificationsService.createReviewCompletedNotification).toHaveBeenCalledWith({
      userId: "user-1",
      reviewId: "review-1",
      claim: "트럼프의 관세 발표",
    });
    expect(result.handoffSourceIds).toEqual(["trump-tariff-update"]);
    expect(result.evidenceSnippets[0]?.stance).toBe("conflict");
    expect(result.evidenceSignals[0]?.sourceId).toBe("trump-tariff-update");
  });

  it("app exception을 review job failed 상태로 기록한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );
    const error = new AppException(
      APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      "질의 정제 실패",
      HttpStatus.BAD_GATEWAY,
    );

    await service.markReviewJobFailed("review-1", error);

    expect(prisma.reviewJob.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
      data: {
        status: "failed",
        currentStage: "failed",
        lastErrorCode: APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      },
    });
  });

  it("unsupported route review를 out_of_scope 상태로 기록한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.persistOutOfScopeReview({
      userId: "user-1",
      reviewJob: { id: "review-1" },
      refinement: {
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        normalizedClaim: "트럼프가 관세를 발표했다",
        claimType: "policy",
        verificationGoal:
          "현재 수집 가능한 출처 기준으로 트럼프의 관세 발표 여부와 최신 상태를 확인한다.",
        searchPlan: {
          normalizedClaim: "트럼프가 관세를 발표했다",
          claimType: "policy",
          verificationGoal:
            "현재 수집 가능한 출처 기준으로 트럼프의 관세 발표 여부와 최신 상태를 확인한다.",
          searchRoute: "unsupported",
          queries: [
            {
              id: "sp1",
              purpose: "claim_specific",
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
        searchClaim: "트럼프의 관세 발표",
        searchQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: false,
        koreaRelevanceReason:
          "claim 자체에 한국 장소, 기관, 시장, 국내 영향이 없습니다.",
      },
      generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
      userCountryCode: "KR",
    });

    expect(prisma.reviewJob.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
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
        reviewJobId: "review-1",
        entryType: "submitted",
      },
    });
    expect(notificationsService.createReviewCompletedNotification).toHaveBeenCalledWith({
      userId: "user-1",
      reviewId: "review-1",
      claim: "트럼프의 관세 발표",
    });
    expect(result.insufficiencyReason).toContain("지원 범위 밖");
  });

  it("사용자 기준 최근 review preview 목록을 조회한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    prisma.reviewJob.findMany.mockResolvedValue([
      {
        id: "review-1",
        clientRequestId: "pending:review-1",
        status: "partial",
        currentStage: "handoff_ready",
        lastErrorCode: null,
        createdAt: new Date("2026-04-01T02:00:00.000Z"),
        claim: {
          rawText: "트럼프가 오늘 관세 발표했대",
        },
        sources: [{ fetchStatus: "fetched" }, { fetchStatus: "pending" }],
      },
    ]);
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.listRecentQueryProcessingPreviews("user-1");

    expect(prisma.reviewJob.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
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
    expect(result).toHaveLength(1);
    expect(result[0]?.clientRequestId).toBe("pending:review-1");
  });

  it("로그인 사용자가 접근 가능한 review preview 상세를 조회한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    prisma.reviewJob.findFirst.mockResolvedValue({
      id: "review-404",
      clientRequestId: "pending:review-404",
      status: "partial",
      currentStage: "handoff_ready",
      lastErrorCode: null,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      claim: {
        id: "claim-1",
        rawText: "트럼프가 오늘 관세 발표했대",
        normalizedText: "트럼프가 오늘 관세 발표했대",
      },
      sources: [],
      evidenceSnippets: [],
    });
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    const result = await service.getQueryProcessingPreview("user-2", "review-404");

    expect(result).toMatchObject({
      id: "review-404",
      clientRequestId: "pending:review-404",
    });
    expect(prisma.reviewJob.findFirst).toHaveBeenCalledWith({
      where: {
        id: "review-404",
        userId: "user-2",
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
  });

  it("다른 사용자의 reviewId는 404를 반환한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    prisma.reviewJob.findFirst.mockResolvedValue(null);
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await expect(
      service.getQueryProcessingPreview("user-2", "review-404"),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: APP_ERROR_CODES.NOT_FOUND,
    });
  });

  it("review와 연결된 알림을 삭제하고 orphan claim을 정리한다", async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    prisma.reviewJob.findFirst.mockResolvedValue({
      id: "review-1",
      claimId: "claim-1",
    });
    prisma.reviewJob.count.mockResolvedValue(0);
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.deleteQueryProcessingPreview("user-1", "review-1");

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        targetType: "review",
        targetId: "review-1",
      },
    });
    expect(prisma.reviewJob.delete).toHaveBeenCalledWith({
      where: {
        id: "review-1",
      },
    });
    expect(prisma.claim.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "claim-1",
      },
    });
  });

  it("같은 claim의 다른 review가 남아 있으면 claim은 유지한다", async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    prisma.reviewJob.findFirst.mockResolvedValue({
      id: "review-1",
      claimId: "claim-1",
    });
    prisma.reviewJob.count.mockResolvedValue(1);
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.deleteQueryProcessingPreview("user-1", "review-1");

    expect(prisma.claim.deleteMany).not.toHaveBeenCalled();
  });

  it("본인 소유가 아닌 review 삭제는 404를 반환한다", async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    prisma.reviewJob.findFirst.mockResolvedValue(null);
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await expect(
      service.deleteQueryProcessingPreview("user-1", "review-404"),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: APP_ERROR_CODES.NOT_FOUND,
    });
  });

  it("reopen history entry를 저장한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await service.recordHistoryEntry({
      userId: "user-1",
      reviewJobId: "review-1",
      entryType: "reopened",
    });

    expect(prisma.userHistory.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        reviewJobId: "review-1",
        entryType: "reopened",
      },
    });
  });

  it("handoff가 없는 review는 reopen 대상에서 제외한다", async () => {
    const prisma = createPrismaMock();
    const notificationsService = createNotificationsServiceMock();
    prisma.reviewJob.findUnique.mockResolvedValue({
      id: "review-404",
      handoffPayload: null,
    });
    const service = new ReviewsQueryPreviewPersistenceService(
      prisma as never,
      notificationsService as never,
    );

    await expect(service.ensureReopenableReview("review-404")).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: APP_ERROR_CODES.NOT_FOUND,
    });
  });
});
