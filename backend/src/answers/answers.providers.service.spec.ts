import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AnswersNaverClient } from "./providers/answers-naver.client";
import { AnswersOpenAiClient } from "./providers/answers-openai.client";
import { AnswersTavilyClient } from "./providers/answers-tavily.client";
import { AnswersProvidersService } from "./answers.providers.service";

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

describe("AnswersProvidersService", () => {
  const originalFetch = global.fetch;
  const createService = (values: Record<string, unknown>) =>
    new AnswersProvidersService(
      createConfigServiceMock(values) as never,
      new AnswersOpenAiClient(),
      new AnswersTavilyClient(),
      new AnswersNaverClient(),
    );

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("real mode에서 OPENAI_API_KEY가 없으면 질의 정제를 실패시킨다", async () => {
    const service = createService({
      answerProviderMode: "real",
      openAiApiKey: null,
    });

    await expect(service.refineQuery("테슬라가 한국에서 철수한대")).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it("real mode에서 NAVER_CLIENT_ID가 없으면 검색을 실패시킨다", async () => {
    const service = createService({
      answerProviderMode: "real",
      naverClientId: null,
      naverClientSecret: "naver-secret",
    });

    await expect(
      service.searchSources({
        searchRoute: "supported",
        queries: [{ id: "q1", text: "테슬라 한국 철수", rank: 1 }],
        coreCheck: "테슬라 한국 철수",
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
      naverClientId: "naver-id",
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

  it("refineQuery는 OpenAI client에 위임한다", async () => {
    const refineSpy = jest
      .spyOn(AnswersOpenAiClient.prototype, "refineQuery")
      .mockResolvedValue({
        coreCheck: "트럼프의 관세 발표",
        normalizedCheck: "트럼프가 관세를 발표했다",
        checkType: "policy",
        answerType: "descriptive_answer",
        searchPlan: { queries: [] },
        generatedQueries: [],
        searchRoute: "unsupported",
        searchRouteReason: "이유",
      });
    const service = createService({
      answerProviderMode: "real",
      openAiApiKey: "openai-test-key",
    });

    const result = await service.refineQuery("트럼프가 관세를 발표했다");

    expect(refineSpy).toHaveBeenCalledWith("openai-test-key", "트럼프가 관세를 발표했다");
    expect(result.coreCheck).toBe("트럼프의 관세 발표");
  });

  it("searchSources는 searchRoute가 supported이면 Naver 검색 후 필요시 TavilyFallback을 호출한다", async () => {
    const naverSpy = jest
      .spyOn(AnswersNaverClient.prototype, "searchNews")
      .mockResolvedValue([
        {
          id: "naver-q2-c1",
          searchRoute: "supported",
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
          retrievalBucket: "familiar",
          domainRegistryId: null,
        },
      ]);
    const searchSourcesSpy = jest
      .spyOn(AnswersTavilyClient.prototype, "searchSources")
      .mockResolvedValue([
        {
          id: "q2-fallback-c1",
          searchRoute: "supported",
          sourceProvider: "tavily-search",
          sourceType: "news",
          publisherName: "yna.co.kr",
          publishedAt: null,
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100002",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100002",
          rawTitle: "테슬라 한국 사업 철수 관련 보도",
          rawSnippet: "Tavily fallback 결과입니다.",
          normalizedHash: "hash-2",
          originQueryIds: ["q2"],
          retrievalBucket: "fallback",
          domainRegistryId: null,
        },
      ]);
    const service = createService({
      answerProviderMode: "real",
      naverClientId: "naver-id",
      naverClientSecret: "naver-secret",
      tavilyApiKey: "tavily-key",
    });

    const result = await service.searchSources({
      searchRoute: "supported",
      queries: [{ id: "q2", text: "테슬라 한국 철수", rank: 1 }],
      coreCheck: "테슬라 한국 철수",
      domainRegistry: [
        {
          id: "kr-news",
          domain: "*.yna.co.kr",
          sourceKind: "news_agency",
          usageRole: "familiar_news",
          priority: 10,
          isActive: true,
        },
        {
          id: "kr-official",
          domain: "*.go.kr",
          sourceKind: "government",
          usageRole: "verification_official",
          priority: 20,
          isActive: true,
        },
        {
          id: "kr-social",
          domain: "youtube.com",
          sourceKind: "social_platform",
          usageRole: "familiar_social",
          priority: 30,
          isActive: true,
        },
        {
          id: "us-verification",
          domain: "reuters.com",
          sourceKind: "news_agency",
          usageRole: "verification_news",
          priority: 5,
          isActive: true,
        },
      ],
    });

    expect(naverSpy).toHaveBeenCalled();
    expect(naverSpy).toHaveBeenCalledWith(
      expect.objectContaining({ display: 8 }),
    );
    expect(searchSourcesSpy).toHaveBeenCalled();
    expect(result.length).toBe(2);
    expect(result[1]?.sourceProvider).toBe("tavily-search");
  });

  it("classifyEvidenceSignals는 OpenAI client에 분류를 위임한다", async () => {
    const classifySpy = jest
      .spyOn(AnswersOpenAiClient.prototype, "classifyEvidenceSignals")
      .mockResolvedValue([
        {
          sourceId: "c1",
          snippetId: null,
          stanceToCheck: "updates",
          temporalRole: "latest_update",
          updateType: "delay",
          currentAnswerImpact: "overrides",
          reason: "최근 연기 보도입니다.",
        },
      ]);
    const service = createService({
      answerProviderMode: "real",
      openAiApiKey: "openai-test-key",
    });
    const input = {
      coreCheck: "테슬라 로드스터 4월 공개",
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
    jest
      .spyOn(AnswersNaverClient.prototype, "searchNews")
      .mockResolvedValue([]);
    const service = createService({
      answerProviderMode: "real",
      naverClientId: "naver-client-id",
      naverClientSecret: "naver-secret",
      tavilyApiKey: null,
    });

    await expect(
      service.searchSources({
        searchRoute: "supported",
        queries: [{ id: "q1", text: "한국은행 기준금리", rank: 1 }],
        coreCheck: "한국은행 기준금리",
        domainRegistry: [],
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });
});
