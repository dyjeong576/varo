import { ReviewsTavilyClient } from "./reviews-tavily.client";
import { SearchCandidate } from "../reviews.types";

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

describe("ReviewsTavilyClient", () => {
  const originalFetch = global.fetch;
  const extractCandidate = {
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
  } satisfies SearchCandidate;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("extract 응답을 normalized content와 snippet으로 변환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          results: [
            {
              url: "https://www.reuters.com/world/us/trump-tariff-update",
              raw_content: "추출 본문입니다.   공백이   정리됩니다.",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new ReviewsTavilyClient();
    const result = await client.extractContent({
      apiKey: "tvly-test-key",
      timeoutMs: 40000,
      candidates: [extractCandidate],
    });

    expect(result).toEqual([
      {
        canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
        contentText: "추출 본문입니다. 공백이 정리됩니다.",
        snippetText: "추출 본문입니다. 공백이 정리됩니다.",
      },
    ]);
  });

  it("extract 부분 실패 응답은 성공한 본문만 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          results: [
            {
              url: "https://www.reuters.com/world/us/trump-tariff-update",
              raw_content: "성공 본문입니다.",
            },
          ],
          failed_results: [
            {
              url: "https://www.bbc.com/news/articles/test",
              error: "Extraction failed",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new ReviewsTavilyClient();
    const result = await client.extractContent({
      apiKey: "tvly-test-key",
      timeoutMs: 40000,
      candidates: [
        extractCandidate,
        {
          ...extractCandidate,
          id: "c2",
          canonicalUrl: "https://www.bbc.com/news/articles/test",
          originalUrl: "https://www.bbc.com/news/articles/test",
        },
      ],
    });

    expect(result).toEqual([
      {
        canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
        contentText: "성공 본문입니다.",
        snippetText: "성공 본문입니다.",
      },
    ]);
  });

  it("extract 전체 URL 실패 응답은 evidence 부족 처리를 위해 빈 배열을 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          results: [],
          failed_results: [
            {
              url: "https://www.reuters.com/world/us/trump-tariff-update",
              error: "Extraction failed",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new ReviewsTavilyClient();
    const result = await client.extractContent({
      apiKey: "tvly-test-key",
      timeoutMs: 40000,
      candidates: [extractCandidate],
    });

    expect(result).toEqual([]);
  });

  it("extract HTTP 실패는 provider 실패로 유지하고 요청 URL 수를 details에 포함한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        ok: false,
        status: 429,
        textData: "rate limited",
      }),
    ) as typeof fetch;

    const client = new ReviewsTavilyClient();

    await expect(
      client.extractContent({
        apiKey: "tvly-test-key",
        timeoutMs: 40000,
        candidates: [extractCandidate],
      }),
    ).rejects.toMatchObject({
      code: "EXTRACTION_FAILED",
      details: {
        status: 429,
        body: "rate limited",
        urlCount: 1,
      },
    });
  });

  it("extract 네트워크 실패는 provider 실패로 유지하고 원인을 details에 포함한다", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network failed"));

    const client = new ReviewsTavilyClient();

    await expect(
      client.extractContent({
        apiKey: "tvly-test-key",
        timeoutMs: 40000,
        candidates: [extractCandidate],
      }),
    ).rejects.toMatchObject({
      code: "EXTRACTION_FAILED",
      details: {
        cause: "network failed",
        urlCount: 1,
      },
    });
  });
});
