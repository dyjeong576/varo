import { ReviewsTavilyClient } from "./reviews-tavily.client";

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
      candidates: [
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
        },
      ],
    });

    expect(result).toEqual([
      {
        canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
        contentText: "추출 본문입니다. 공백이 정리됩니다.",
        snippetText: "추출 본문입니다. 공백이 정리됩니다.",
      },
    ]);
  });
});
