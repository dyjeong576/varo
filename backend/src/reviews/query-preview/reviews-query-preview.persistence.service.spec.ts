import { Prisma } from "@prisma/client";
import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { ReviewsQueryPreviewPersistenceService } from "./reviews-query-preview.persistence.service";

describe("ReviewsQueryPreviewPersistenceService", () => {
  const createPrismaMock = () => ({
    claim: {
      create: jest.fn().mockResolvedValue({
        id: "claim-1",
        rawText: "트럼프가 오늘 관세 발표했대",
      }),
    },
    reviewJob: {
      create: jest.fn().mockResolvedValue({
        id: "review-1",
        createdAt: new Date("2026-04-01T02:00:00.000Z"),
        clientRequestId: "pending:review-1",
      }),
      update: jest.fn().mockResolvedValue(undefined),
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
  });

  it("clientRequestId를 포함해 claim과 review job을 생성한다", async () => {
    const prisma = createPrismaMock();
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

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
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

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
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

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
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

    const result = await service.persistQueryPreviewResult({
      userId: "user-1",
      reviewJob: { id: "review-1" },
      refinement: {
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
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
          relevanceTier: "primary",
          relevanceReason: "원문 검증 source입니다.",
        },
      ],
      extractionTargets: [
        {
          id: "c1",
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
      primaryExtractionLimit: 5,
    });

    expect(prisma.source.create).toHaveBeenCalledTimes(1);
    expect(prisma.evidenceSnippet.create).toHaveBeenCalledTimes(1);
    expect(prisma.reviewJob.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
      data: expect.objectContaining({
        status: "partial",
        currentStage: "handoff_ready",
        searchedSourceCount: 1,
        processedSourceCount: 1,
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
    expect(result.handoffSourceIds).toEqual(["trump-tariff-update"]);
  });

  it("사용자 국가나 주제 국가와 무관하게 KR domain registry만 조회한다", async () => {
    const prisma = createPrismaMock();
    prisma.sourceDomainRegistry.findMany.mockResolvedValue([
      {
        id: "kr-familiar",
        domain: "yna.co.kr",
        countryCode: "KR",
        languageCode: "ko",
        sourceKind: "news_agency",
        usageRole: "familiar_news",
        priority: 10,
        isActive: true,
      },
    ]);
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

    const result = await service.loadSearchDomainRegistry();

    expect(prisma.sourceDomainRegistry.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        usageRole: {
          in: [
            "familiar_news",
            "familiar_social",
            "verification_official",
            "verification_news",
          ],
        },
        countryCode: {
          in: ["KR"],
        },
      },
      orderBy: [{ priority: "asc" }, { countryCode: "asc" }],
    });
    expect(result).toEqual([
      {
        id: "kr-familiar",
        domain: "yna.co.kr",
        countryCode: "KR",
        languageCode: "ko",
        sourceKind: "news_agency",
        usageRole: "familiar_news",
        priority: 10,
        isActive: true,
      },
    ]);
  });

  it("app exception을 review job failed 상태로 기록한다", async () => {
    const prisma = createPrismaMock();
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);
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

  it("한국 관련성이 없는 review를 out_of_scope 상태로 기록한다", async () => {
    const prisma = createPrismaMock();
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

    const result = await service.persistOutOfScopeReview({
      userId: "user-1",
      reviewJob: { id: "review-1" },
      refinement: {
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
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
    expect(result.insufficiencyReason).toContain("MVP 검토 범위 밖");
  });

  it("사용자 기준 최근 review preview 목록을 조회한다", async () => {
    const prisma = createPrismaMock();
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
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

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
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

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
    prisma.reviewJob.findFirst.mockResolvedValue(null);
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

    await expect(
      service.getQueryProcessingPreview("user-2", "review-404"),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: APP_ERROR_CODES.NOT_FOUND,
    });
  });

  it("reopen history entry를 저장한다", async () => {
    const prisma = createPrismaMock();
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

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
    prisma.reviewJob.findUnique.mockResolvedValue({
      id: "review-404",
      handoffPayload: null,
    });
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

    await expect(service.ensureReopenableReview("review-404")).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: APP_ERROR_CODES.NOT_FOUND,
    });
  });
});
