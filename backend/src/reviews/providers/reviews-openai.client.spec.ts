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
    const result = await client.refineQuery(
      "openai-test-key",
      "트럼프가 오늘 관세 발표했대",
    );

    expect(result.topicCountryCode).toBe("US");
    expect(result.searchRoute).toBe("global_news");
    expect(result.searchClaim).toBe("Trump tariff announcement");
    expect(result.normalizedClaim).toBe("트럼프가 관세를 발표했다");
    expect(result.claimType).toBe("policy");
    expect(result.searchPlan.queries).toHaveLength(4);
    expect(result.searchPlan.queries.map((query) => query.purpose)).toEqual([
      "claim_specific",
      "current_state",
      "primary_source",
      "contradiction_or_update",
    ]);
    expect(result.searchQueries).toHaveLength(3);
    expect(result.searchQueries[0]?.text).toBe("Trump tariff announcement");
    expect(result.isKoreaRelated).toBe(false);
    expect(result.koreaRelevanceReason).toContain("한국");
    expect(result.generatedQueries).toHaveLength(3);
    expect(result.generatedQueries[0]?.text).toBe("트럼프 관세 발표");
  });

  it("search plan purpose가 중복되어도 누락 purpose를 fallback query로 보정한다", async () => {
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
                    verificationGoal: "트럼프의 관세 발표 여부를 확인한다.",
                    searchPlan: {
                      normalizedClaim: "트럼프가 관세를 발표했다",
                      claimType: "policy",
                      verificationGoal: "트럼프의 관세 발표 여부를 확인한다.",
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
                          purpose: "claim_specific",
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
                      "미국 관세 정책 발표",
                      "트럼프 관세 업데이트",
                    ],
                    searchRoute: "global_news",
                    searchRouteReason:
                      "미국 정책 발표를 다루는 해외 뉴스성 claim입니다.",
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
    const result = await client.refineQuery(
      "openai-test-key",
      "트럼프가 오늘 관세 발표했대",
    );

    expect(result.searchPlan.queries.map((query) => query.purpose)).toEqual([
      "claim_specific",
      "current_state",
      "primary_source",
      "contradiction_or_update",
    ]);
    expect(result.searchPlan.queries[1]?.query).toBe(
      "US tariff policy announcement",
    );
  
  });

  it("structured output text를 evidence signal 결과로 변환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    signals: [
                      {
                        sourceId: "candidate-1",
                        stanceToClaim: "updates",
                        temporalRole: "latest_update",
                        updateType: "delay",
                        currentAnswerImpact: "overrides",
                        reason: "최근 보도에서 일정이 다음 달로 연기됐다고 설명합니다.",
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

    const client = new ReviewsOpenAiClient();
    const result = await client.classifyEvidenceSignals("openai-test-key", {
      coreClaim: "테슬라가 2026년 4월에 로드스터 차량을 공개한다",
      claimLanguageCode: "ko",
      searchPlan: {
        normalizedClaim: "테슬라 로드스터 2026년 4월 공개",
        claimType: "scheduled_event",
        verificationGoal: "현재 공개 일정 확인",
        searchRoute: "global_news",
        queries: [
          { id: "q1", purpose: "claim_specific", query: "Tesla Roadster April 2026", priority: 1 },
          { id: "q2", purpose: "current_state", query: "Tesla Roadster current status", priority: 2 },
          { id: "q3", purpose: "primary_source", query: "Tesla official Roadster", priority: 3 },
          { id: "q4", purpose: "contradiction_or_update", query: "Tesla Roadster delayed", priority: 4 },
        ],
      },
      sources: [
        {
          sourceId: "candidate-1",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: "2026-04-24T00:00:00.000Z",
          rawTitle: "Tesla Roadster reveal delayed",
          rawSnippet: "Roadster reveal has been delayed to next month.",
          originQueryIds: ["q4"],
          retrievalBucket: "verification",
          evidenceSnippetText: "Roadster reveal has been delayed to next month.",
        },
      ],
    });

    expect(result).toEqual([
      {
        sourceId: "candidate-1",
        snippetId: null,
        stanceToClaim: "updates",
        temporalRole: "latest_update",
        updateType: "delay",
        currentAnswerImpact: "overrides",
        reason: "최근 보도에서 일정이 다음 달로 연기됐다고 설명합니다.",
      },
    ]);
  });
});
