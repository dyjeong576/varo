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
      service.searchSources([{ id: "q1", text: "테슬라 한국 철수", rank: 1 }], "테슬라 한국 철수"),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it("real mode에서 OpenAI 질의 정제 응답을 QueryArtifact로 변환한다", async () => {
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
                    coreClaim: "테슬라의 한국 시장 철수",
                    generatedQueries: [
                      "테슬라 한국 사업 철수 2026",
                      "Tesla Korea market exit",
                      "테슬라 한국 영업 중단",
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

    const result = await service.refineQuery("나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대");

    expect(result.languageCode).toBe("ko");
    expect(result.coreClaim).toBe("테슬라의 한국 시장 철수");
    expect(result.generatedQueries).toEqual([
      { id: "q1", text: "테슬라 한국 사업 철수 2026", rank: 1 },
      { id: "q2", text: "Tesla Korea market exit", rank: 2 },
      { id: "q3", text: "테슬라 한국 영업 중단", rank: 3 },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer openai-test-key",
        }),
      }),
    );
  });

  it("real mode에서 Tavily 검색 결과를 SearchCandidate로 매핑한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          results: [
            {
              title: "테슬라 한국 사업 철수 관련 보도",
              url: "https://news.example.com/articles/varo-core?utm_source=test",
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

    const result = await service.searchSources(
      [{ id: "q1", text: "테슬라 한국 철수", rank: 1 }],
      "테슬라 한국 철수",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "q1-c1",
      canonicalUrl: "https://news.example.com/articles/varo-core",
      originalUrl: "https://news.example.com/articles/varo-core?utm_source=test",
      originQueryIds: ["q1"],
      publisherName: "news.example.com",
      sourceType: "news",
    });
    expect(result[0]?.publishedAt).toBe("2026-04-01T00:00:00.000Z");
  });

  it("real mode에서 OpenAI relevance 응답을 primary/reference/discard로 반영한다", async () => {
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
                        relevanceTier: "primary",
                        relevanceReason: "공식 출처와 직접 관련됩니다.",
                      },
                      {
                        candidateId: "c2",
                        relevanceTier: "reference",
                        relevanceReason: "배경 맥락으로는 유효합니다.",
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

    const result = await service.applyRelevanceFiltering("테슬라 한국 철수", [
      {
        id: "c1",
        sourceType: "official",
        publisherName: "정부부처",
        publishedAt: null,
        canonicalUrl: "https://www.gov.example.kr/press/varo-official",
        originalUrl: "https://www.gov.example.kr/press/varo-official",
        rawTitle: "테슬라 한국 사업 관련 공식 입장",
        rawSnippet: "공식 설명입니다.",
        normalizedHash: "hash-1",
        originQueryIds: ["q1"],
      },
      {
        id: "c2",
        sourceType: "analysis",
        publisherName: "해설 매체",
        publishedAt: null,
        canonicalUrl: "https://analysis.example.com/varo-explainer",
        originalUrl: "https://analysis.example.com/varo-explainer",
        rawTitle: "테슬라 한국 철수 해설",
        rawSnippet: "직접 근거는 약하지만 맥락을 설명합니다.",
        normalizedHash: "hash-2",
        originQueryIds: ["q2"],
      },
    ]);

    expect(result[0]?.relevanceTier).toBe("primary");
    expect(result[0]?.relevanceReason).toBe("공식 출처와 직접 관련됩니다.");
    expect(result[1]?.relevanceTier).toBe("reference");
    expect(result[1]?.relevanceReason).toBe("배경 맥락으로는 유효합니다.");
  });

  it("real mode에서 Tavily 추출 결과를 본문과 snippet으로 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          results: [
            {
              url: "https://news.example.com/articles/varo-core?utm_source=test",
              raw_content:
                "테슬라가 한국 시장 운영 계획을 조정한다는 본문 내용입니다. 후속 설명과 세부 맥락이 이어집니다.",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const service = new ReviewsProvidersService(
      createConfigServiceMock({
        reviewProviderMode: "real",
        tavilyApiKey: "tvly-test-key",
        tavilyExtractTimeoutMs: 80000,
      }) as never,
    );

    const result = await service.extractContent([
      {
        id: "c1",
        sourceType: "news",
        publisherName: "연합뉴스",
        publishedAt: null,
        canonicalUrl: "https://news.example.com/articles/varo-core",
        originalUrl: "https://news.example.com/articles/varo-core?utm_source=test",
        rawTitle: "테슬라 한국 사업 철수 관련 보도",
        rawSnippet: "검색 snippet",
        normalizedHash: "hash-1",
        originQueryIds: ["q1"],
        relevanceTier: "primary",
        relevanceReason: "직접 관련 기사입니다.",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.canonicalUrl).toBe("https://news.example.com/articles/varo-core");
    expect(result[0]?.contentText).toContain("테슬라가 한국 시장 운영 계획을 조정한다는 본문 내용입니다.");
    expect(result[0]?.snippetText).toContain("테슬라가 한국 시장 운영 계획을 조정한다는 본문 내용입니다.");
  });

  it("real mode에서 Tavily 검색 응답이 실패하면 명시적으로 예외를 던진다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        ok: false,
        status: 500,
        textData: "{\"error\":\"upstream failed\"}",
      }),
    ) as typeof fetch;

    const service = new ReviewsProvidersService(
      createConfigServiceMock({
        reviewProviderMode: "real",
        tavilyApiKey: "tvly-test-key",
        tavilySearchTimeoutMs: 40000,
      }) as never,
    );

    await expect(
      service.searchSources([{ id: "q1", text: "테슬라 한국 철수", rank: 1 }], "테슬라 한국 철수"),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
      status: HttpStatus.BAD_GATEWAY,
    });
  });
});
