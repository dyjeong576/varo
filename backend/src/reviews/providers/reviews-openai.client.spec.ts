import { ReviewsOpenAiClient } from "./reviews-openai.client";

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

describe("ReviewsOpenAiClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("structured output text를 query refinement 결과로 변환한다", async () => {
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
                    searchRoute: "global_news",
                    searchRouteReason: "미국 관세 발표를 다루는 해외/글로벌 뉴스성 claim입니다.",
                    searchClaim: "Trump tariff announcement",
                    searchQueries: [
                      "Trump tariff announcement",
                      "US tariff policy announcement",
                      "Trump tariff update",
                    ],
                    topicScope: "foreign",
                    topicCountryCode: "US",
                    countryDetectionReason: "미국 이슈로 판단했습니다.",
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

    const client = new ReviewsOpenAiClient();
    const result = await client.refineQuery("openai-test-key", "트럼프가 오늘 관세 발표했대");

    expect(result.topicCountryCode).toBe("US");
    expect(result.searchRoute).toBe("global_news");
    expect(result.searchClaim).toBe("Trump tariff announcement");
    expect(result.searchQueries).toHaveLength(3);
    expect(result.isKoreaRelated).toBe(false);
    expect(result.koreaRelevanceReason).toContain("한국");
    expect(result.generatedQueries).toHaveLength(3);
  });
});
