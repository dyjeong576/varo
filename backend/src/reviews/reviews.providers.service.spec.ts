import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { ReviewsNaverClient } from "./providers/reviews-naver.client";
import { ReviewsOpenAiClient } from "./providers/reviews-openai.client";
import { ReviewsTavilyClient } from "./providers/reviews-tavily.client";
import { ReviewsProvidersService } from "./reviews.providers.service";

function createConfigServiceMock(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key in values ? values[key] : defaultValue,
    ),
  };
}

function createFetchResponse({
  ok = true,
  status = 200,
  jsonData,
  textData = "",
}: {
  ok?: boolean;
  status?: number;
  jsonData?: unknown;
  textData?: string;
}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(jsonData),
    text: jest.fn().mockResolvedValue(textData),
  } as unknown as Response;
}

describe("ReviewsProvidersService", () => {
  const originalFetch = global.fetch;
  const createService = (values: Record<string, unknown>) =>
    new ReviewsProvidersService(
      createConfigServiceMock(values) as never,
      new ReviewsOpenAiClient(),
      new ReviewsTavilyClient(),
      new ReviewsNaverClient(),
    );

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("real mode에서 OPENAI_API_KEY가 없으면 질의 정제를 실패시킨다", async () => {
    const service = createService({
      reviewProviderMode: "real",
      openAiApiKey: null,
    });

    await expect(service.refineQuery("테슬라가 한국에서 철수한대")).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it("real mode에서 NAVER_CLIENT_ID가 없으면 검색을 실패시킨다", async () => {
    const service = createService({
      reviewProviderMode: "real",
      naverClientId: null,
      naverClientSecret: "naver-secret",
    });

    await expect(
      service.searchSources({
        searchRoute: "korean_news",
        queries: [{ id: "q1", text: "테슬라 한국 철수", rank: 1 }],
        coreClaim: "테슬라 한국 철수",
        claimLanguageCode: "ko",
        userCountryCode: "KR",
        topicCountryCode: "KR",
        topicScope: "domestic",
        domainRegistry: [],
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it("Naver 테스트 검색에서 NAVER_CLIENT_ID가 없으면 실패시킨다", async () => {
    const service = createService({
      naverClientId: null,
      naverClientSecret: "naver-secret",
    });

    await expect(
      service.searchNaverNewsForTest({
        query: "테슬라 한국 철수",
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it("Naver 테스트 검색에서 NAVER_CLIENT_SECRET이 없으면 실패시킨다", async () => {
    const service = createService({
      naverClientId: "naver-client-id",
      naverClientSecret: null,
    });

    await expect(
      service.searchNaverNewsForTest({
        query: "테슬라 한국 철수",
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it("real mode에서 OpenAI 질의 정제 응답을 topic country 메타데이터와 함께 변환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    languageCode: "ko",
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
                    generatedQueries: [
                      "트럼프 관세 발표",
                      "Trump tariff announcement",
                      "미국 관세 정책 발표",
                    ],
                    searchRoute: "global_news",
                    searchRouteReason:
                      "미국 관세 발표를 다루는 해외/글로벌 뉴스성 claim입니다.",
                    searchClaim: "Trump tariff announcement",
                    searchQueries: [
                      "Trump tariff announcement",
                      "US tariff policy announcement",
                      "Trump tariff update",
                    ],
                    topicScope: "foreign",
                    topicCountryCode: "US",
                    countryDetectionReason:
                      "미국 대통령과 관세 발표 단서가 확인되어 미국 이슈로 판단했습니다.",
                    isKoreaRelated: false,
                    koreaRelevanceReason:
                      "claim 자체에 한국 장소, 기관, 시장, 국내 영향이 없습니다.",
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const service = createService({
      reviewProviderMode: "real",
      openAiApiKey: "openai-test-key",
    });

    const result = await service.refineQuery("트럼프가 오늘 관세 발표했대");

    expect(result.claimLanguageCode).toBe("ko");
    expect(result.topicScope).toBe("foreign");
    expect(result.topicCountryCode).toBe("US");
    expect(result.searchRoute).toBe("unsupported");
    expect(result.searchClaim).toBe("Trump tariff announcement");
    expect(result.searchPlan.queries).toHaveLength(4);
    expect(result.isKoreaRelated).toBe(false);
    expect(result.generatedQueries).toHaveLength(3);
  });

  it("real mode에서 한국 관련 검색을 Naver 뉴스 검색 client에 위임한다", async () => {
    const searchNewsSpy = jest
      .spyOn(ReviewsNaverClient.prototype, "searchNews")
      .mockResolvedValue([
        {
          id: "naver-q2-c1",
          searchRoute: "korean_news",
          sourceProvider: "naver-search",
          sourceType: "news",
          publisherName: "yna.co.kr",
          publishedAt: "2026-04-01T00:00:00.000Z",
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://n.news.naver.com/mnews/article/001/0010000001",
          rawTitle: "테슬라 한국 사업 철수 관련 보도",
          rawSnippet: "테슬라 한국 사업 철수 관련 핵심 내용이 담긴 기사입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q2"],
          sourceCountryCode: "KR",
          retrievalBucket: "familiar",
          domainRegistryId: null,
        },
      ]);
    const searchSourcesSpy = jest
      .spyOn(ReviewsTavilyClient.prototype, "searchSources")
      .mockResolvedValue([
        {
          id: "q2-fallback-c1",
          searchRoute: "korean_news",
          sourceProvider: "tavily-search",
          sourceType: "news",
          publisherName: "yna.co.kr",
          publishedAt: null,
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100002",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100002",
          rawTitle: "테슬라 한국 사업 관련 추가 보도",
          rawSnippet: "국내 추가 보도입니다.",
          normalizedHash: "hash-2",
          originQueryIds: ["q2"],
          sourceCountryCode: "KR",
          retrievalBucket: "fallback",
          domainRegistryId: "kr-familiar",
        },
        {
          id: "q2-fallback-c2",
          searchRoute: "korean_news",
          sourceProvider: "tavily-search",
          sourceType: "news",
          publisherName: "reuters.com",
          publishedAt: null,
          canonicalUrl: "https://www.reuters.com/world/us/tesla-update",
          originalUrl: "https://www.reuters.com/world/us/tesla-update",
          rawTitle: "Tesla update",
          rawSnippet: "해외 보도입니다.",
          normalizedHash: "hash-3",
          originQueryIds: ["q2"],
          sourceCountryCode: "US",
          retrievalBucket: "fallback",
          domainRegistryId: null,
        },
      ]);
    const service = createService({
      reviewProviderMode: "real",
      naverClientId: "naver-client-id",
      naverClientSecret: "naver-secret",
      naverSearchTimeoutMs: 40000,
      tavilyApiKey: "tvly-test-key",
      tavilySearchTimeoutMs: 41000,
    });

    const result = await service.searchSources({
      searchRoute: "korean_news",
      queries: [
        {
          id: "q2",
          text: "테슬라 한국 철수",
          rank: 1,
          purpose: "claim_specific",
        },
      ],
      coreClaim: "테슬라 한국 철수",
      claimLanguageCode: "ko",
      userCountryCode: "US",
      topicCountryCode: "US",
      topicScope: "foreign",
      domainRegistry: [
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
          id: "kr-official",
          domain: "*.go.kr",
          countryCode: "KR",
          languageCode: "ko",
          sourceKind: "government",
          usageRole: "verification_official",
          priority: 20,
          isActive: true,
        },
        {
          id: "kr-social",
          domain: "youtube.com",
          countryCode: "KR",
          languageCode: null,
          sourceKind: "social_platform",
          usageRole: "familiar_social",
          priority: 30,
          isActive: true,
        },
        {
          id: "us-verification",
          domain: "reuters.com",
          countryCode: "US",
          languageCode: "en",
          sourceKind: "news_agency",
          usageRole: "verification_news",
          priority: 5,
          isActive: true,
        },
      ],
    });

    expect(result[0]).toMatchObject({
      id: "naver-q2-c1",
      canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
      originalUrl: "https://n.news.naver.com/mnews/article/001/0010000001",
      originQueryIds: ["q2"],
      retrievalBucket: "familiar",
      sourceCountryCode: "KR",
      domainRegistryId: null,
    });
    expect(result[1]).toMatchObject({
      id: "q2-fallback-c1",
      searchRoute: "korean_news",
      sourceProvider: "tavily-search",
      sourceCountryCode: "KR",
      retrievalBucket: "fallback",
    });
    expect(result).toHaveLength(2);
    expect(searchNewsSpy).toHaveBeenCalledWith({
      clientId: "naver-client-id",
      clientSecret: "naver-secret",
      timeoutMs: 40000,
      query: "테슬라 한국 철수",
      queryId: "q2",
      queryPurpose: "claim_specific",
      display: 5,
      start: 1,
      sort: "sim",
    });
    expect(searchSourcesSpy).toHaveBeenCalledWith({
      apiKey: "tvly-test-key",
      timeoutMs: 41000,
      input: expect.objectContaining({
        searchRoute: "korean_news",
      }),
      bucket: "fallback",
      includeDomains: ["yna.co.kr", "youtube.com", "go.kr"],
    });
  });

  it("global_news route는 source search를 수행하지 않는다", async () => {
    const searchSourcesSpy = jest
      .spyOn(ReviewsTavilyClient.prototype, "searchSources")
      .mockResolvedValue([]);
    const service = createService({
      reviewProviderMode: "real",
      tavilyApiKey: "tvly-test-key",
      tavilySearchTimeoutMs: 41000,
    });

    await expect(
      service.searchSources({
        searchRoute: "global_news",
        queries: [
          {
            id: "q1",
            text: "Trump tariff announcement",
            rank: 1,
            purpose: "current_state",
          },
        ],
        coreClaim: "트럼프의 관세 발표",
        claimLanguageCode: "ko",
        userCountryCode: "KR",
        topicCountryCode: "US",
        topicScope: "foreign",
        domainRegistry: [],
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
      status: HttpStatus.BAD_REQUEST,
    });
    expect(searchSourcesSpy).not.toHaveBeenCalled();
  });

  it("real mode에서 OpenAI relevance 요청에 retrieval bucket과 source country를 포함한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    decisions: [
                      {
                        candidateId: "c1",
                        relevanceTier: "reference",
                        relevanceReason: "해외 이슈에서 국내 기사라 보조 근거로 유지합니다.",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const service = createService({
      reviewProviderMode: "real",
      openAiApiKey: "openai-test-key",
    });

    const result = await service.applyRelevanceFiltering({
      coreClaim: "트럼프의 관세 발표",
      claimLanguageCode: "ko",
      searchRoute: "global_news",
      topicCountryCode: "US",
      topicScope: "foreign",
      candidates: [
        {
          id: "c1",
          searchRoute: "global_news",
          sourceProvider: "tavily-search",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: null,
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "트럼프 관세 발표 관련 한국 보도",
          rawSnippet: "국내 종합 기사입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          originQueryPurposes: ["current_state"],
          sourceCountryCode: "KR",
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
      ],
    });

    expect(result[0]?.relevanceTier).toBe("reference");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining("\"retrievalBucket\\\": \\\"familiar\\\""),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining("\"originQueryPurposes\\\": ["),
      }),
    );
  });

  it("applyRelevanceFiltering은 OpenAI API key가 없으면 실패한다", async () => {
    const service = createService({
      reviewProviderMode: "mock",
      openAiApiKey: null,
    });

    await expect(
      service.applyRelevanceFiltering({
      coreClaim: "트럼프의 관세 발표",
      claimLanguageCode: "ko",
      searchRoute: "global_news",
      topicCountryCode: "US",
      topicScope: "foreign",
      candidates: [
        {
          id: "c1",
          searchRoute: "global_news",
          sourceProvider: "tavily-search",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: null,
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "트럼프 관세 발표 기사",
          rawSnippet: "트럼프 관세 발표 세부 내용입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          sourceCountryCode: "KR",
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
      ],
    }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it("classifyEvidenceSignals는 OpenAI client에 분류를 위임한다", async () => {
    const classifySpy = jest
      .spyOn(ReviewsOpenAiClient.prototype, "classifyEvidenceSignals")
      .mockResolvedValue([
        {
          sourceId: "c1",
          snippetId: null,
          stanceToClaim: "updates",
          temporalRole: "latest_update",
          updateType: "delay",
          currentAnswerImpact: "overrides",
          reason: "최근 연기 보도입니다.",
        },
      ]);
    const service = createService({
      reviewProviderMode: "real",
      openAiApiKey: "openai-test-key",
    });
    const input = {
      coreClaim: "테슬라 로드스터 4월 공개",
      claimLanguageCode: "ko",
      searchPlan: null,
      sources: [
        {
          sourceId: "c1",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: "2026-04-24T00:00:00.000Z",
          rawTitle: "Roadster delayed",
          rawSnippet: "Delayed to next month",
          originQueryIds: ["q4"],
          retrievalBucket: "verification" as const,
          evidenceSnippetText: "Delayed to next month",
        },
      ],
    };

    const result = await service.classifyEvidenceSignals(input);

    expect(classifySpy).toHaveBeenCalledWith("openai-test-key", input);
    expect(result[0]?.currentAnswerImpact).toBe("overrides");
  });

  it("한국 뉴스 보조검색에서 TAVILY_API_KEY가 없으면 실패시킨다", async () => {
    const service = createService({
      reviewProviderMode: "real",
      naverClientId: "naver-client-id",
      naverClientSecret: "naver-secret",
      tavilyApiKey: null,
    });

    await expect(
      service.searchSources({
        searchRoute: "korean_news",
        queries: [{ id: "q1", text: "한국은행 기준금리", rank: 1 }],
        coreClaim: "한국은행 기준금리",
        claimLanguageCode: "ko",
        userCountryCode: "KR",
        topicCountryCode: "KR",
        topicScope: "domestic",
        domainRegistry: [],
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });
});
