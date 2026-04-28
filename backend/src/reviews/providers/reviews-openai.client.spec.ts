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

  it("scope gate에서 unsupported면 query refinement 없이 out_of_scope 결과로 변환한다", async () => {
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
                    searchRoute: "unsupported",
                    searchRouteReason:
                      "미국 관세 발표를 다루는 해외/글로벌 뉴스성 claim입니다.",
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
    expect(result.searchRoute).toBe("unsupported");
    expect(result.searchClaim).toBe("트럼프의 관세 발표");
    expect(result.normalizedClaim).toBe("트럼프가 관세를 발표했다");
    expect(result.claimType).toBe("policy");
    expect(result.searchPlan.queries).toEqual([]);
    expect(result.searchQueries).toEqual([]);
    expect(result.isKoreaRelated).toBe(false);
    expect(result.koreaRelevanceReason).toContain("한국");
    expect(result.generatedQueries).toEqual([
      { id: "q1", text: "트럼프의 관세 발표", rank: 1 },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("search plan purpose가 중복되어도 누락 purpose를 fallback query로 보정한다", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(
        createFetchResponse({
          jsonData: {
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      languageCode: "ko",
                      coreClaim: "한국 기준금리 동결",
                      normalizedClaim: "한국은행이 기준금리를 동결했다",
                      claimType: "policy",
                      verificationGoal: "한국은행 기준금리 동결 여부를 확인한다.",
                      searchRoute: "korean_news",
                      searchRouteReason:
                        "한국 경제 정책 관련 뉴스성 claim입니다.",
                      topicScope: "domestic",
                      topicCountryCode: "KR",
                      countryDetectionReason: "한국은행 기준금리 이슈입니다.",
                      isKoreaRelated: true,
                      koreaRelevanceReason: "한국 경제 정책이 직접 포함되어 있습니다.",
                    }),
                  },
                ],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    languageCode: "ko",
                    coreClaim: "한국 기준금리 동결",
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
                        {
                          id: "sp2",
                          purpose: "claim_specific",
                          query: "기준금리 최신 뉴스",
                          priority: 2,
                        },
                        {
                          id: "sp3",
                          purpose: "primary_source",
                          query: "한국은행 금융통화위원회 기준금리",
                          priority: 3,
                        },
                        {
                          id: "sp4",
                          purpose: "contradiction_or_update",
                          query: "기준금리 동결 변경 전망",
                          priority: 4,
                        },
                      ],
                    },
                    generatedQueries: [
                      "한국은행 기준금리 동결",
                      "기준금리 동결 발표",
                      "금융통화위원회 기준금리",
                    ],
                    searchRoute: "korean_news",
                    searchRouteReason:
                      "한국 경제 정책 관련 뉴스성 claim입니다.",
                    searchClaim: "한국은행 기준금리 동결",
                    searchQueries: [
                      "한국은행 기준금리 동결",
                      "기준금리 최신 뉴스",
                      "금융통화위원회 기준금리",
                    ],
                    topicScope: "domestic",
                    topicCountryCode: "KR",
                    countryDetectionReason: "한국은행 기준금리 이슈입니다.",
                    isKoreaRelated: true,
                    koreaRelevanceReason: "한국 경제 정책이 직접 포함되어 있습니다.",
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
      "한국은행이 기준금리 동결했대",
    );

    expect(result.searchPlan.queries.map((query) => query.purpose)).toEqual([
      "claim_specific",
      "current_state",
      "primary_source",
      "contradiction_or_update",
    ]);
    expect(result.searchPlan.queries[1]?.query).toBe(
      "기준금리 최신 뉴스",
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
