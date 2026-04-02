import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
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

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("real mode에서 OPENAI_API_KEY가 없으면 질의 정제를 실패시킨다", async () => {
    const service = new ReviewsProvidersService(
      createConfigServiceMock({
        reviewProviderMode: "real",
        openAiApiKey: null,
      }) as never,
    );

    await expect(service.refineQuery("테슬라가 한국에서 철수한대")).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it("real mode에서 TAVILY_API_KEY가 없으면 검색을 실패시킨다", async () => {
    const service = new ReviewsProvidersService(
      createConfigServiceMock({
        reviewProviderMode: "real",
        tavilyApiKey: null,
      }) as never,
    );

    await expect(
      service.searchSources({
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
                    generatedQueries: [
                      "트럼프 관세 발표",
                      "Trump tariff announcement",
                      "미국 관세 정책 발표",
                    ],
                    topicScope: "foreign",
                    topicCountryCode: "US",
                    countryDetectionReason:
                      "미국 대통령과 관세 발표 단서가 확인되어 미국 이슈로 판단했습니다.",
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const service = new ReviewsProvidersService(
      createConfigServiceMock({
        reviewProviderMode: "real",
        openAiApiKey: "openai-test-key",
      }) as never,
    );

    const result = await service.refineQuery("트럼프가 오늘 관세 발표했대");

    expect(result.claimLanguageCode).toBe("ko");
    expect(result.topicScope).toBe("foreign");
    expect(result.topicCountryCode).toBe("US");
    expect(result.generatedQueries).toHaveLength(3);
  });

  it("real mode에서 familiar/verification include_domains를 Tavily에 전달한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          results: [
            {
              title: "테슬라 한국 사업 철수 관련 보도",
              url: "https://www.yna.co.kr/view/AKR20260401000100001",
              content: "테슬라 한국 사업 철수 관련 핵심 내용이 담긴 기사입니다.",
              published_date: "2026-04-01T00:00:00Z",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const service = new ReviewsProvidersService(
      createConfigServiceMock({
        reviewProviderMode: "real",
        tavilyApiKey: "tvly-test-key",
        tavilySearchTimeoutMs: 40000,
      }) as never,
    );

    const result = await service.searchSources({
      queries: [{ id: "q1", text: "테슬라 한국 철수", rank: 1 }],
      coreClaim: "테슬라 한국 철수",
      claimLanguageCode: "ko",
      userCountryCode: "KR",
      topicCountryCode: "KR",
      topicScope: "domestic",
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
      ],
    });

    expect(result[0]).toMatchObject({
      retrievalBucket: "familiar",
      sourceCountryCode: "KR",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"include_domains\":[\"yna.co.kr\"]"),
      }),
    );
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

    const service = new ReviewsProvidersService(
      createConfigServiceMock({
        reviewProviderMode: "real",
        openAiApiKey: "openai-test-key",
      }) as never,
    );

    const result = await service.applyRelevanceFiltering({
      coreClaim: "트럼프의 관세 발표",
      claimLanguageCode: "ko",
      topicCountryCode: "US",
      topicScope: "foreign",
      candidates: [
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
      ],
    });

    expect(result[0]?.relevanceTier).toBe("reference");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining("\"retrievalBucket\\\": \\\"familiar\\\""),
      }),
    );
  });

  it("mock mode에서 foreign topic familiar 기사 primary를 reference로 낮춘다", async () => {
    const service = new ReviewsProvidersService(
      createConfigServiceMock({
        reviewProviderMode: "mock",
      }) as never,
    );

    const result = await service.applyRelevanceFiltering({
      coreClaim: "트럼프의 관세 발표",
      claimLanguageCode: "ko",
      topicCountryCode: "US",
      topicScope: "foreign",
      candidates: [
        {
          id: "c1",
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
    });

    expect(result[0]?.relevanceTier).toBe("reference");
  });
});
