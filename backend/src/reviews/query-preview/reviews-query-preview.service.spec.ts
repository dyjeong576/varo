import { HttpStatus, Logger } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { ReviewsProvidersService } from "../reviews.providers.service";
import { ReviewsQueryPreviewService } from "./reviews-query-preview.service";

describe("ReviewsQueryPreviewService", () => {
  const createPersistenceMock = () => ({
    validateNormalizedClaim: jest.fn((normalizedClaim: string) => {
      if (!normalizedClaim) {
        throw new AppException(
          APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
          "검토할 claim을 입력해 주세요.",
          HttpStatus.BAD_REQUEST,
        );
      }
    }),
    findQueryProcessingPreviewByClientRequestId: jest.fn().mockResolvedValue(null),
    createClaimAndReviewJob: jest.fn().mockImplementation(
      ({ clientRequestId }: { clientRequestId?: string }) =>
        Promise.resolve({
          claim: {
            id: "claim-1",
            rawText: "트럼프가 오늘 관세 발표했대",
          },
          reviewJob: {
            id: "review-1",
            createdAt: new Date("2026-04-01T02:00:00.000Z"),
            clientRequestId: clientRequestId ?? null,
          },
        }),
    ),
    resolveUserCountryCode: jest.fn().mockResolvedValue("KR"),
    loadSearchDomainRegistry: jest.fn().mockResolvedValue([
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
      {
        id: "us-verification",
        domain: "reuters.com",
        countryCode: "US",
        languageCode: "en",
        sourceKind: "news_agency",
        usageRole: "verification_news",
        priority: 20,
        isActive: true,
      },
    ]),
    resetQueryProcessingPreview: jest.fn().mockResolvedValue(undefined),
    persistQueryPreviewResult: jest.fn(),
    markReviewJobFailed: jest.fn().mockResolvedValue(undefined),
    ensurePreviewUser: jest.fn().mockResolvedValue({
      id: "preview-user-1",
    }),
    listRecentQueryProcessingPreviews: jest.fn().mockResolvedValue([]),
    getQueryProcessingPreview: jest.fn(),
    ensureReopenableReview: jest.fn().mockResolvedValue({
      id: "review-1",
      handoffPayload: {
        sourceIds: ["source-1"],
      },
    }),
    recordHistoryEntry: jest.fn().mockResolvedValue(undefined),
  });

  it("빈 claim이면 입력 검증 예외를 던진다", async () => {
    const persistence = createPersistenceMock();
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      {} as never,
    );

    await expect(
      service.createQueryProcessingPreview("user-1", {
        claim: "   ",
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(persistence.createClaimAndReviewJob).not.toHaveBeenCalled();
  });

  it("country-aware query processing preview를 저장하고 응답 메타데이터를 반환한다", async () => {
    const persistence = createPersistenceMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "Trump tariff announcement", rank: 2 },
          { id: "q3", text: "미국 관세 정책 발표", rank: 3 },
        ],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason:
          "미국 대통령과 관세 정책 단서가 확인되어 미국 이슈로 판단했습니다.",
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
          sourceCountryCode: "KR",
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
          sourceCountryCode: "US",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
        },
      ]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      applyRelevanceFiltering: jest
        .fn()
        .mockImplementation(async ({ candidates }) =>
          candidates.map((candidate: Record<string, unknown>) => ({
            ...candidate,
            relevanceTier:
              candidate.retrievalBucket === "verification" ? "primary" : "reference",
            relevanceReason:
              candidate.retrievalBucket === "verification"
                ? "원문 검증 source입니다."
                : "국내 친숙형 보도로 보조 근거입니다.",
          })),
        ),
      extractContent: jest.fn().mockResolvedValue([
        {
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          contentText: "추출 본문",
          snippetText: "추출 snippet",
        },
      ]),
    } as unknown as ReviewsProvidersService;
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
          sourceCountryCode: "KR",
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
          sourceCountryCode: "US",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
        },
      ],
      evidenceSnippets: [
        {
          id: "snippet-source-2",
          reviewJobId: "review-1",
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
    });
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
    });

    expect(result.reviewId).toBe("review-1");
    expect(result.rawClaim).toBe("트럼프가 오늘 관세 발표했대");
    expect(result.createdAt).toBe("2026-04-01T02:00:00.000Z");
    expect(result.claimLanguageCode).toBe("ko");
    expect(result.topicScope).toBe("foreign");
    expect(result.topicCountryCode).toBe("US");
    expect(result.countryDetectionReason).toContain("미국");
    expect(result.generatedQueries).toHaveLength(1);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]?.retrievalBucket).toBe("familiar");
    expect(result.sources[1]?.retrievalBucket).toBe("verification");
    expect(result.sources[1]?.domainRegistryMatched).toBe(true);
    expect(result.evidenceSnippets).toHaveLength(1);
    expect(persistence.resolveUserCountryCode).toHaveBeenCalledWith("user-1");
    expect(providers.searchSources).toHaveBeenCalledWith(
      expect.objectContaining({
        userCountryCode: "KR",
        topicCountryCode: "US",
      }),
    );
    expect(persistence.loadSearchDomainRegistry).toHaveBeenCalledWith({
      userCountryCode: "KR",
      topicCountryCode: "US",
      topicScope: "foreign",
    });
  });

  it("같은 clientRequestId로 다시 호출하면 같은 reviewId를 재사용한다", async () => {
    const persistence = createPersistenceMock();
    persistence.findQueryProcessingPreviewByClientRequestId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "review-1",
        clientRequestId: "pending:review-1",
        status: "partial",
        currentStage: "handoff_ready",
        searchedSourceCount: 1,
        lastErrorCode: null,
        createdAt: new Date("2026-04-01T02:00:00.000Z"),
        claim: {
          id: "claim-1",
          rawText: "트럼프가 오늘 관세 발표했대",
          normalizedText: "트럼프가 오늘 관세 발표했대",
        },
        queryRefinement: {
          claimLanguageCode: "ko",
          languageCode: "ko",
          coreClaim: "트럼프의 관세 발표",
          generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
          topicScope: "foreign",
          topicCountryCode: "US",
          countryDetectionReason: "미국 이슈로 판단했습니다.",
        },
        handoffPayload: {
          coreClaim: "트럼프의 관세 발표",
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
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      applyRelevanceFiltering: jest.fn().mockResolvedValue([]),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as ReviewsProvidersService;
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const firstResult = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:review-1",
    });
    const secondResult = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:review-1",
    });

    expect(firstResult.reviewId).toBe("review-1");
    expect(secondResult.reviewId).toBe("review-1");
    expect(firstResult.clientRequestId).toBe("pending:review-1");
    expect(secondResult.clientRequestId).toBe("pending:review-1");
    expect(persistence.createClaimAndReviewJob).toHaveBeenCalledTimes(1);
    expect(persistence.resetQueryProcessingPreview).not.toHaveBeenCalled();
  });

  it("같은 clientRequestId의 searching review는 초기화 후 같은 reviewId로 재실행한다", async () => {
    const persistence = createPersistenceMock();
    persistence.findQueryProcessingPreviewByClientRequestId.mockResolvedValue({
      id: "review-1",
      clientRequestId: "pending:review-1",
      status: "searching",
      currentStage: "query_refinement",
      searchedSourceCount: 0,
      lastErrorCode: null,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      claim: {
        id: "claim-1",
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
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      applyRelevanceFiltering: jest.fn().mockResolvedValue([]),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as ReviewsProvidersService;
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:review-1",
    });

    expect(result.reviewId).toBe("review-1");
    expect(result.clientRequestId).toBe("pending:review-1");
    expect(persistence.createClaimAndReviewJob).not.toHaveBeenCalled();
    expect(persistence.resetQueryProcessingPreview).toHaveBeenCalledWith("review-1");
  });

  it("같은 clientRequestId의 failed review는 초기화 후 같은 reviewId로 재실행한다", async () => {
    const persistence = createPersistenceMock();
    persistence.findQueryProcessingPreviewByClientRequestId.mockResolvedValue({
      id: "review-1",
      clientRequestId: "pending:review-1",
      status: "failed",
      currentStage: "failed",
      searchedSourceCount: 0,
      lastErrorCode: APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      claim: {
        id: "claim-1",
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
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      applyRelevanceFiltering: jest.fn().mockResolvedValue([]),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as ReviewsProvidersService;
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
      clientRequestId: "pending:review-1",
    });

    expect(result.reviewId).toBe("review-1");
    expect(result.clientRequestId).toBe("pending:review-1");
    expect(persistence.createClaimAndReviewJob).not.toHaveBeenCalled();
    expect(persistence.resetQueryProcessingPreview).toHaveBeenCalledWith("review-1");
    expect(providers.refineQuery).toHaveBeenCalledTimes(1);
  });

  it("저장된 review preview 목록을 summary 응답으로 매핑한다", async () => {
    const persistence = createPersistenceMock();
    persistence.listRecentQueryProcessingPreviews.mockResolvedValue([
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
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      {} as never,
    );

    const result = await service.listQueryProcessingPreviews("user-1");

    expect(result).toEqual([
      {
        reviewId: "review-1",
        clientRequestId: "pending:review-1",
        rawClaim: "트럼프가 오늘 관세 발표했대",
        status: "partial",
        currentStage: "handoff_ready",
        createdAt: "2026-04-01T02:00:00.000Z",
        selectedSourceCount: 1,
        lastErrorCode: null,
      },
    ]);
  });

  it("저장된 review preview 상세를 응답 DTO로 매핑한다", async () => {
    const persistence = createPersistenceMock();
    persistence.getQueryProcessingPreview.mockResolvedValue({
      id: "review-1",
      clientRequestId: "pending:review-1",
      status: "partial",
      currentStage: "handoff_ready",
      searchedSourceCount: 2,
      lastErrorCode: null,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      claim: {
        id: "claim-1",
        rawText: "트럼프가 오늘 관세 발표했대",
        normalizedText: "트럼프가 오늘 관세 발표했대",
      },
      queryRefinement: {
        claimLanguageCode: "ko",
        languageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
      },
      handoffPayload: {
        coreClaim: "트럼프의 관세 발표",
        sourceIds: ["source-2"],
        snippetIds: ["snippet-1"],
        insufficiencyReason: null,
      },
      sources: [
        {
          id: "source-2",
          reviewJobId: "review-1",
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
          sourceCountryCode: "US",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
        },
      ],
      evidenceSnippets: [
        {
          id: "snippet-1",
          reviewJobId: "review-1",
          sourceId: "source-2",
          snippetText: "추출 snippet",
          stance: "neutral",
          startOffset: null,
          endOffset: null,
        },
      ],
    });
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      {} as never,
    );

    const result = await service.getQueryProcessingPreview("user-1", "review-1");

    expect(result.reviewId).toBe("review-1");
    expect(result.clientRequestId).toBe("pending:review-1");
    expect(result.rawClaim).toBe("트럼프가 오늘 관세 발표했대");
    expect(result.sources[0]?.originalUrl).toBe(
      "https://www.reuters.com/world/us/trump-tariff-update",
    );
    expect(result.sources[0]?.publishedAt).toBe("2026-04-01T01:00:00.000Z");
    expect(result.sources[0]?.stance).toBe("support");
    expect(result.handoff.sourceIds).toEqual(["source-2"]);
    expect(result.result.mode).toBe("rule_based_preview");
    expect(result.result.verdict).toBe("Unclear");
  });

  it("verification source가 부족하면 fallback search를 수행한다", async () => {
    const persistence = createPersistenceMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "Trump tariff announcement", rank: 2 },
          { id: "q3", text: "미국 관세 정책 발표", rank: 3 },
        ],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
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
          sourceCountryCode: "KR",
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
      ]),
      searchFallbackSources: jest.fn().mockResolvedValue([
        {
          id: "c2",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: null,
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          normalizedHash: "hash-2",
          originQueryIds: ["q2"],
          sourceCountryCode: "US",
          retrievalBucket: "fallback",
          domainRegistryId: "us-verification",
        },
      ]),
      applyRelevanceFiltering: jest
        .fn()
        .mockResolvedValueOnce([
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
            sourceCountryCode: "KR",
            retrievalBucket: "familiar",
            domainRegistryId: "kr-familiar",
            relevanceTier: "reference",
            relevanceReason: "보조 근거입니다.",
          },
        ])
        .mockResolvedValueOnce([
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
            sourceCountryCode: "KR",
            retrievalBucket: "familiar",
            domainRegistryId: "kr-familiar",
            relevanceTier: "reference",
            relevanceReason: "보조 근거입니다.",
          },
          {
            id: "c2",
            sourceType: "news",
            publisherName: "Reuters",
            publishedAt: null,
            canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
            originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
            rawTitle: "Trump tariff announcement update",
            rawSnippet: "원문 검증 보도입니다.",
            normalizedHash: "hash-2",
            originQueryIds: ["q2"],
            sourceCountryCode: "US",
            retrievalBucket: "fallback",
            domainRegistryId: "us-verification",
            relevanceTier: "primary",
            relevanceReason: "fallback으로 확보한 검증 source입니다.",
          },
        ]),
      extractContent: jest.fn().mockResolvedValue([
        {
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          contentText: "추출 본문",
          snippetText: "추출 snippet",
        },
      ]),
    } as unknown as ReviewsProvidersService;
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
          sourceCountryCode: "KR",
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
          relevanceReason: "fallback으로 확보한 검증 source입니다.",
          originQueryIds: ["q2"],
          sourceCountryCode: "US",
          retrievalBucket: "fallback",
          domainRegistryId: "us-verification",
        },
      ],
      evidenceSnippets: [
        {
          id: "snippet-source-2",
          reviewJobId: "review-1",
          sourceId: "source-2",
          snippetText: "추출 snippet",
          stance: "neutral",
          startOffset: null,
          endOffset: null,
        },
      ],
      discardedSourceCount: 0,
      handoffSourceIds: ["source-2"],
      insufficiencyReason: null,
    });
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
    });

    expect(providers.searchFallbackSources).toHaveBeenCalledTimes(1);
    expect(result.sources.some((source) => source.retrievalBucket === "fallback")).toBe(true);
  });

  it("refinement가 실패해도 claim은 남기고 review job을 failed로 기록한다", async () => {
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
    } as unknown as ReviewsProvidersService;
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    await expect(
      service.createQueryProcessingPreview("user-1", {
        claim: "테슬라가 한국에서 완전 철수한대",
        clientRequestId: "pending:review-1",
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      status: HttpStatus.BAD_GATEWAY,
    });

    expect(persistence.createClaimAndReviewJob).toHaveBeenCalledTimes(1);
    expect(persistence.markReviewJobFailed).toHaveBeenCalledWith("review-1", error);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "review query processing preview failed userId=user-1 reviewJobId=review-1 claimId=claim-1 clientRequestId=pending:review-1 errorCode=LLM_SCHEMA_ERROR",
      ),
      expect.any(String),
    );
    expect(loggerSpy.mock.calls[0]?.[0]).not.toContain("테슬라가 한국에서 완전 철수한대");
    loggerSpy.mockRestore();
  });

  it("reopen 요청을 history entry로 기록한다", async () => {
    const persistence = createPersistenceMock();
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      {} as never,
    );

    await service.recordReviewReopen("user-1", "review-1");

    expect(persistence.ensureReopenableReview).toHaveBeenCalledWith("review-1");
    expect(persistence.recordHistoryEntry).toHaveBeenCalledWith({
      userId: "user-1",
      reviewJobId: "review-1",
      entryType: "reopened",
    });
  });
});
