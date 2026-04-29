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
    resetQueryProcessingPreview: jest.fn().mockResolvedValue(undefined),
    persistQueryPreviewResult: jest.fn(),
    persistSearchPreviewSources: jest.fn(),
    persistOutOfScopeReview: jest.fn().mockResolvedValue({
      insufficiencyReason:
        "뉴스성 또는 사실성 검토 지원 범위 밖 claim으로 기록되었습니다.",
    }),
    markReviewJobFailed: jest.fn().mockResolvedValue(undefined),
    ensurePreviewUser: jest.fn().mockResolvedValue({
      id: "preview-user-1",
    }),
    listRecentQueryProcessingPreviews: jest.fn().mockResolvedValue([]),
    getQueryProcessingPreview: jest.fn(),
    deleteQueryProcessingPreview: jest.fn().mockResolvedValue(undefined),
    ensureReopenableReview: jest.fn().mockResolvedValue({
      id: "review-1",
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

  it("사용자 국가와 무관하게 주제 국가를 유지하고 Naver 검색 경로로 source를 수집한다", async () => {
    const persistence = createPersistenceMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
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
          searchRoute: "korean_news",
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
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "Trump tariff announcement", rank: 2 },
          { id: "q3", text: "미국 관세 정책 발표", rank: 3 },
        ],
        searchRoute: "korean_news",
        searchRouteReason: "한국 시장 영향이 직접 포함된 한국 뉴스성 claim입니다.",
        searchClaim: "트럼프 관세 발표",
        searchQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "Trump tariff announcement", rank: 2 },
          { id: "q3", text: "미국 관세 정책 발표", rank: 3 },
        ],
        topicCountryCode: "US",
        countryDetectionReason:
          "미국 대통령과 관세 정책 단서가 확인되어 미국 이슈로 판단했습니다.",
        isKoreaRelated: true,
        koreaRelevanceReason: "한국 시장에 대한 직접 영향이 포함되어 있습니다.",
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
                stanceToClaim: "supports",
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
      applyRelevanceFiltering: jest.fn(),
      classifyEvidenceSignals: jest.fn(),
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
      evidenceSignals: [
        {
          sourceId: "source-2",
          snippetId: "snippet-source-2",
          stanceToClaim: "supports",
          temporalRole: "current_status",
          updateType: "confirmation",
          currentAnswerImpact: "strengthens",
          reason: "원문 검증 보도입니다.",
        },
      ],
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
    expect(result.topicCountryCode).toBe("US");
    expect(result.countryDetectionReason).toContain("미국");
    expect(result.generatedQueries).toHaveLength(3);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]?.retrievalBucket).toBe("familiar");
    expect(result.sources[1]?.retrievalBucket).toBe("verification");
    expect(result.sources[1]?.domainRegistryMatched).toBe(false);
    expect(result.evidenceSnippets).toHaveLength(1);
    expect(result.evidenceSnippets[0]?.evidenceSummary).toBe("원문 검증 source입니다.");
    expect(providers.classifyRelevanceAndEvidenceSignals).toHaveBeenCalledWith(
      expect.objectContaining({
        coreClaim: "트럼프의 관세 발표",
        candidates: expect.arrayContaining([
          expect.objectContaining({
            id: "c2",
            rawSnippet: "원문 검증 보도입니다.",
          }),
        ]),
      }),
    );
    expect(providers.applyRelevanceFiltering).not.toHaveBeenCalled();
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
        searchRoute: "korean_news",
        queries: [
          {
            id: "sp1",
            text: "트럼프 관세 발표",
            rank: 1,
            purpose: "claim_specific",
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
        topicCountryCode: "US",
        domainRegistry: expect.arrayContaining([
          expect.objectContaining({
            id: "kr-centrist-yna",
            countryCode: "KR",
          }),
        ]),
      }),
    );
  });

  it("async preview는 검색 완료 직후 source를 먼저 반환하고 background 분류를 이어간다", async () => {
    const persistence = createPersistenceMock();
    const refinement = {
      claimLanguageCode: "ko",
      coreClaim: "한국은행 기준금리 동결",
      normalizedClaim: "한국은행이 기준금리를 동결했다",
      claimType: "policy",
      verificationGoal: "한국은행 기준금리 동결 여부를 확인한다.",
      searchPlan: {
        normalizedClaim: "한국은행이 기준금리를 동결했다",
        claimType: "policy",
        verificationGoal: "한국은행 기준금리 동결 여부를 확인한다.",
        searchRoute: "korean_news",
        queries: [
          {
            id: "sp1",
            purpose: "claim_specific",
            query: "한국은행 기준금리 동결",
            priority: 1,
          },
        ],
      },
      generatedQueries: [{ id: "q1", text: "한국은행 기준금리 동결", rank: 1 }],
      searchRoute: "korean_news",
      searchRouteReason: "한국 경제 뉴스 claim입니다.",
      searchClaim: "한국은행 기준금리 동결",
      searchQueries: [{ id: "q1", text: "한국은행 기준금리 동결", rank: 1 }],
      topicCountryCode: "KR",
      countryDetectionReason: "한국 이슈로 판단했습니다.",
      isKoreaRelated: true,
      koreaRelevanceReason: "한국 기관과 경제 정책이 포함되어 있습니다.",
    };
    const candidate = {
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
      sourceCountryCode: "KR",
      retrievalBucket: "familiar",
      domainRegistryId: "kr-centrist-yna",
    };
    const createdSource = {
      id: "source-1",
      reviewJobId: "review-1",
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
      sourceCountryCode: "KR",
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
            relevanceReason: "claim을 직접 다루는 기사입니다.",
          },
        ],
        evidenceSignals: [
          {
            sourceId: "c1",
            snippetId: null,
            stanceToClaim: "supports",
            temporalRole: "current_status",
            updateType: "confirmation",
            currentAnswerImpact: "strengthens",
            reason: "기준금리 동결을 확인합니다.",
          },
        ],
      }),
    } as unknown as ReviewsProvidersService;
    persistence.persistSearchPreviewSources.mockResolvedValue([createdSource]);
    persistence.persistQueryPreviewResult.mockResolvedValue({
      createdSources: [createdSource],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: ["source-1"],
      insufficiencyReason: null,
      evidenceSignals: [],
    });
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreviewAsync("user-1", {
      claim: "한국은행이 기준금리를 동결했다",
      clientRequestId: "pending:review-1",
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
        claimLanguageCode: "ko",
        coreClaim: "한국은행 기준금리 동결",
        normalizedClaim: "한국은행이 기준금리를 동결했다",
        claimType: "policy",
        verificationGoal: "한국은행 기준금리 동결 여부를 확인한다.",
        searchPlan: {
          normalizedClaim: "한국은행이 기준금리를 동결했다",
          claimType: "policy",
          verificationGoal: "한국은행 기준금리 동결 여부를 확인한다.",
          searchRoute: "korean_news",
          queries: [
            {
              id: "sp1",
              purpose: "claim_specific",
              query: "한국은행 기준금리 동결",
              priority: 1,
            },
          ],
        },
        generatedQueries: [{ id: "q1", text: "한국은행 기준금리 동결", rank: 1 }],
        searchRoute: "korean_news",
        searchRouteReason: "한국 경제 뉴스 claim입니다.",
        searchClaim: "한국은행 기준금리 동결",
        searchQueries: [{ id: "q1", text: "한국은행 기준금리 동결", rank: 1 }],
        topicCountryCode: "KR",
        countryDetectionReason: "한국 이슈로 판단했습니다.",
        isKoreaRelated: true,
        koreaRelevanceReason: "한국 기관과 경제 정책이 포함되어 있습니다.",
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
          sourceCountryCode: "KR",
          retrievalBucket: "familiar",
          domainRegistryId: "kr-centrist-yna",
        },
      ]),
      classifyRelevanceAndEvidenceSignals: jest
        .fn()
        .mockRejectedValue(new Error("classification failed")),
    } as unknown as ReviewsProvidersService;
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
        sourceCountryCode: "KR",
        retrievalBucket: "familiar",
      },
    ]);
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    await service.createQueryProcessingPreviewAsync("user-1", {
      claim: "한국은행이 기준금리를 동결했다",
    });
    await flushPromises();

    expect(persistence.persistSearchPreviewSources).toHaveBeenCalledTimes(1);
    expect(persistence.markReviewJobFailed).toHaveBeenCalledWith(
      "review-1",
      expect.any(Error),
    );
    loggerSpy.mockRestore();
  });

  it("async preview는 같은 clientRequestId의 진행 중 review를 중복 생성하지 않는다", async () => {
    const persistence = createPersistenceMock();
    persistence.findQueryProcessingPreviewByClientRequestId.mockResolvedValue({
      id: "review-1",
      clientRequestId: "pending:review-1",
      status: "searching",
      currentStage: "relevance_and_signal_classification",
      searchedSourceCount: 1,
      lastErrorCode: null,
      createdAt: new Date("2026-04-01T02:00:00.000Z"),
      claim: {
        id: "claim-1",
        rawText: "한국은행이 기준금리를 동결했다",
        normalizedText: "한국은행이 기준금리를 동결했다",
      },
      queryRefinement: null,
      handoffPayload: null,
      sources: [],
      evidenceSnippets: [],
    });
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      {} as never,
    );

    const result = await service.createQueryProcessingPreviewAsync("user-1", {
      claim: "한국은행이 기준금리를 동결했다",
      clientRequestId: "pending:review-1",
    });

    expect(result.reviewId).toBe("review-1");
    expect(persistence.createClaimAndReviewJob).not.toHaveBeenCalled();
    expect(persistence.resetQueryProcessingPreview).not.toHaveBeenCalled();
    expect(persistence.persistSearchPreviewSources).not.toHaveBeenCalled();
  });

  it("해외뉴스 claim은 out_of_scope로 저장하고 source 수집을 건너뛴다", async () => {
    const persistence = createPersistenceMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
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
          "VARO는 현재 한국뉴스만 분석하므로 해외 뉴스 claim은 지원 범위 밖입니다.",
        searchClaim: "Trump tariff announcement",
        searchQueries: [
          { id: "q1", text: "Trump tariff announcement", rank: 1 },
          { id: "q2", text: "US tariff policy announcement", rank: 2 },
          { id: "q3", text: "Trump tariff update", rank: 3 },
        ],
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: false,
        koreaRelevanceReason:
          "claim 자체에 한국 장소, 기관, 시장, 국내 영향이 없습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      applyRelevanceFiltering: jest.fn().mockResolvedValue([]),
      extractContent: jest.fn().mockResolvedValue([]),
    } as unknown as ReviewsProvidersService;
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
    });

    expect(result.status).toBe("out_of_scope");
    expect(result.generatedQueries).toEqual([
      { id: "q1", text: "트럼프 관세 발표", rank: 1 },
      { id: "q2", text: "미국 관세 정책 발표", rank: 2 },
      { id: "q3", text: "트럼프 관세 업데이트", rank: 3 },
    ]);
    expect(providers.searchSources).not.toHaveBeenCalled();
    expect(persistence.persistOutOfScopeReview).toHaveBeenCalledWith(
      expect.objectContaining({
        refinement: expect.objectContaining({
          searchRoute: "unsupported",
        }),
      }),
    );
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
          topicCountryCode: "US",
          countryDetectionReason: "미국 이슈로 판단했습니다.",
          isKoreaRelated: true,
          koreaRelevanceReason: "기존 저장 payload에는 한국 관련성 판정이 포함되어 있습니다.",
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
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: true,
        koreaRelevanceReason: "한국 시장에 대한 직접 영향이 포함되어 있습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      classifyRelevanceAndEvidenceSignals: jest.fn().mockResolvedValue({
        relevanceCandidates: [],
        evidenceSignals: [],
      }),
      applyRelevanceFiltering: jest.fn(),
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
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: true,
        koreaRelevanceReason: "한국 시장에 대한 직접 영향이 포함되어 있습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      classifyRelevanceAndEvidenceSignals: jest.fn().mockResolvedValue({
        relevanceCandidates: [],
        evidenceSignals: [],
      }),
      applyRelevanceFiltering: jest.fn(),
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
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: true,
        koreaRelevanceReason: "한국 시장에 대한 직접 영향이 포함되어 있습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      classifyRelevanceAndEvidenceSignals: jest.fn().mockResolvedValue({
        relevanceCandidates: [],
        evidenceSignals: [],
      }),
      applyRelevanceFiltering: jest.fn(),
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
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: true,
        koreaRelevanceReason: "한국 시장에 대한 직접 영향이 포함되어 있습니다.",
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
    expect(result.evidenceSnippets[0]?.evidenceSummary).toBe("원문 검증 source입니다.");
    expect(result.clientRequestId).toBe("pending:review-1");
    expect(result.rawClaim).toBe("트럼프가 오늘 관세 발표했대");
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
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "미국 관세 정책", rank: 2 },
          { id: "q3", text: "Trump tariff", rank: 3 },
        ],
        searchRoute: "unsupported",
        searchRouteReason: "기사/공식 발표 검색만으로 검토하기 어려운 요청입니다.",
        searchClaim: "트럼프 관세 발표",
        searchQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "미국 관세 정책", rank: 2 },
          { id: "q3", text: "Trump tariff", rank: 3 },
        ],
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: false,
        koreaRelevanceReason:
          "claim 자체에 한국 장소, 기관, 시장, 국내 영향이 없습니다.",
      }),
      searchSources: jest.fn(),
      searchFallbackSources: jest.fn(),
      applyRelevanceFiltering: jest.fn(),
      extractContent: jest.fn(),
    } as unknown as ReviewsProvidersService;
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
    });

    expect(result.status).toBe("out_of_scope");
    expect(result.currentStage).toBe("scope_checked");
    expect(result.result).toBeNull();
    expect(result.sources).toEqual([]);
    expect(result.isKoreaRelated).toBe(false);
    expect(result.koreaRelevanceReason).toContain("한국");
    expect(persistence.persistOutOfScopeReview).toHaveBeenCalledWith({
      userId: "user-1",
      reviewJob: expect.objectContaining({ id: "review-1" }),
      refinement: expect.objectContaining({
        searchRoute: "unsupported",
        isKoreaRelated: false,
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
    expect(providers.applyRelevanceFiltering).not.toHaveBeenCalled();
    expect(providers.extractContent).not.toHaveBeenCalled();
  });

  it("verification source가 부족해도 domainless fallback search를 수행하지 않는다", async () => {
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
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        isKoreaRelated: true,
        koreaRelevanceReason: "한국 시장에 대한 직접 영향이 포함되어 있습니다.",
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
              sourceCountryCode: "KR",
              retrievalBucket: "familiar",
              domainRegistryId: "kr-familiar",
              relevanceTier: "reference",
              relevanceReason: "보조 근거입니다.",
            },
          ],
          evidenceSignals: [],
        }),
      applyRelevanceFiltering: jest.fn(),
      extractContent: jest.fn().mockResolvedValue([]),
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
      ],
      evidenceSnippets: [],
      discardedSourceCount: 0,
      handoffSourceIds: [],
      insufficiencyReason:
        "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    });
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      providers,
    );

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
    });

    expect(
      (providers as unknown as { searchFallbackSources: jest.Mock }).searchFallbackSources,
    ).not.toHaveBeenCalled();
    expect(result.sources.some((source) => source.retrievalBucket === "fallback")).toBe(false);
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

  it("review 삭제 요청을 persistence에 위임한다", async () => {
    const persistence = createPersistenceMock();
    const service = new ReviewsQueryPreviewService(
      persistence as never,
      {} as never,
    );

    await service.deleteQueryProcessingPreview("user-1", "review-1");

    expect(persistence.deleteQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      "review-1",
    );
  });
});
