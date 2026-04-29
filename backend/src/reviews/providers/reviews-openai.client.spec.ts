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

  it("단일 LLM 호출에서 unsupported 판정 시 out_of_scope 결과로 변환한다", async () => {
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
                      "미국 관세 발표를 다루는 해외/글로벌 뉴스성 claim입니다. VARO가 현재 한국 뉴스만 분석한다.",
                    searchPlan: {
                      normalizedClaim: "트럼프가 관세를 발표했다",
                      claimType: "policy",
                      verificationGoal:
                        "현재 수집 가능한 출처 기준으로 트럼프의 관세 발표 여부와 최신 상태를 확인한다.",
                      searchRoute: "unsupported",
                      queries: [],
                    },
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

    expect(result.topicCountryCode).toBeNull();
    expect(result.searchRoute).toBe("unsupported");
    expect(result.searchClaim).toBe("트럼프가 관세를 발표했다");
    expect(result.normalizedClaim).toBe("트럼프가 관세를 발표했다");
    expect(result.claimType).toBe("policy");
    expect(result.searchPlan.queries).toEqual([]);
    expect(result.searchQueries).toEqual([]);
    expect(result.isKoreaRelated).toBe(false);
    expect(result.koreaRelevanceReason).toBe("");
    expect(result.generatedQueries).toEqual([
      { id: "q1", text: "트럼프의 관세 발표", rank: 1 },
    ]);
    expect(
      JSON.parse((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body as string),
    ).toMatchObject({
      reasoning: { effort: "minimal" },
      text: { verbosity: "low" },
      max_output_tokens: 1000,
    });
    expect((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body).toEqual(
      expect.stringContaining("사용자가 연도·기간을 말하지 않았으면 특정 연도·기간을 만들지 말 것"),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("단일 LLM 호출에서 search plan purpose가 중복되어도 누락 purpose를 fallback query로 보정한다", async () => {
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
                    coreClaim: "한국 기준금리 동결",
                    normalizedClaim: "한국은행이 기준금리를 동결했다",
                    claimType: "policy",
                    verificationGoal: "한국은행 기준금리 동결 여부를 확인한다.",
                    searchRoute: "korean_news",
                    searchRouteReason:
                      "한국 경제 정책 관련 뉴스성 claim입니다.",
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
    // sp2는 claim_specific 중복이므로 버려지고 current_state는 fallback 쿼리(coreClaim, index=1)로 채워진다
    expect(result.searchPlan.queries[1]?.query).toBe(
      "한국 기준금리 동결",
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("claim의 관할과 장소가 한국 정치 맥락이면 korean_news route로 유지한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    coreClaim: "일론 머스크의 부산 국회의원 출마",
                    normalizedClaim: "일론 머스크가 부산에서 국회의원에 출마한다",
                    claimType: "scheduled_event",
                    searchRoute: "korean_news",
                    searchPlan: {
                      queries: [
                        {
                          id: "sp1",
                          purpose: "claim_specific",
                          query: "일론 머스크 부산 출마",
                          priority: 1,
                        },
                        {
                          id: "sp2",
                          purpose: "current_state",
                          query: "일론 머스크 국회의원 출마 여부",
                          priority: 2,
                        },
                        {
                          id: "sp3",
                          purpose: "primary_source",
                          query: "일론 머스크 출마 공식 발표",
                          priority: 3,
                        },
                        {
                          id: "sp4",
                          purpose: "contradiction_or_update",
                          query: "일론 머스크 출마 부인 정정",
                          priority: 4,
                        },
                      ],
                    },
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
      "일론머스크가 부산 국회의원 출마한다는게 사실이야?",
    );

    expect(result.searchRoute).toBe("korean_news");
    expect(result.isKoreaRelated).toBe(true);
    expect(result.topicCountryCode).toBe("KR");
    expect(result.searchPlan.queries).toHaveLength(4);
  });

  it("해외 기업명으로 시작해도 한국 시장 영향 claim이면 korean_news route로 유지한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    coreClaim: "해외 기업의 한국 서비스 종료",
                    normalizedClaim: "해외 기업이 한국에서 서비스를 종료한다",
                    claimType: "corporate_action",
                    searchRoute: "korean_news",
                    searchPlan: {
                      queries: [
                        {
                          id: "sp1",
                          purpose: "claim_specific",
                          query: "해외 기업 한국 서비스 종료",
                          priority: 1,
                        },
                        {
                          id: "sp2",
                          purpose: "current_state",
                          query: "한국 서비스 종료 여부 최신",
                          priority: 2,
                        },
                        {
                          id: "sp3",
                          purpose: "primary_source",
                          query: "한국 서비스 종료 공식 발표",
                          priority: 3,
                        },
                        {
                          id: "sp4",
                          purpose: "contradiction_or_update",
                          query: "한국 서비스 종료 부인 정정",
                          priority: 4,
                        },
                      ],
                    },
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
      "어떤 해외 기업이 한국 서비스 접는다는 게 사실이야?",
    );

    expect(result.searchRoute).toBe("korean_news");
    expect(result.isKoreaRelated).toBe(true);
    expect(result.topicCountryCode).toBe("KR");
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

  it("structured output text를 relevance와 evidence signal 결과로 함께 변환한다", async () => {
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
                        candidateId: "candidate-1",
                        relevanceTier: "primary",
                        relevanceReason: "최신 연기 보도입니다.",
                        stanceToClaim: "updates",
                        temporalRole: "latest_update",
                        updateType: "delay",
                        currentAnswerImpact: "overrides",
                      },
                      {
                        candidateId: "candidate-2",
                        relevanceTier: "discard",
                        relevanceReason: "claim 검토와 직접 관련이 낮습니다.",
                        stanceToClaim: "unknown",
                        temporalRole: "background",
                        updateType: "none",
                        currentAnswerImpact: "neutral",
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
    const result = await client.classifyRelevanceAndEvidenceSignals(
      "openai-test-key",
      {
        coreClaim: "테슬라가 2026년 4월에 로드스터 차량을 공개한다",
        claimLanguageCode: "ko",
        searchRoute: "korean_news",
        topicCountryCode: "KR",
        searchPlan: null,
        candidates: [
          {
            id: "candidate-1",
            searchRoute: "korean_news",
            sourceProvider: "naver-search",
            sourceType: "news",
            publisherName: "Reuters",
            publishedAt: "2026-04-24T00:00:00.000Z",
            canonicalUrl: "https://www.reuters.com/technology/tesla-roadster",
            originalUrl: "https://www.reuters.com/technology/tesla-roadster",
            rawTitle: "Tesla Roadster reveal delayed",
            rawSnippet: "Roadster reveal has been delayed to next month.",
            normalizedHash: "hash-1",
            originQueryIds: ["q4"],
            retrievalBucket: "verification",
            sourceCountryCode: "KR",
            domainRegistryId: "kr-verification",
          },
          {
            id: "candidate-2",
            searchRoute: "korean_news",
            sourceProvider: "naver-search",
            sourceType: "news",
            publisherName: "한국경제",
            publishedAt: null,
            canonicalUrl: "https://www.hankyung.com/article/202604010001",
            originalUrl: "https://www.hankyung.com/article/202604010001",
            rawTitle: "전기차 시장 반응",
            rawSnippet: "시장 반응을 전했습니다.",
            normalizedHash: "hash-2",
            originQueryIds: ["q1"],
            retrievalBucket: "familiar",
            sourceCountryCode: "KR",
            domainRegistryId: "kr-familiar",
          },
        ],
      },
    );
    const requestBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0]?.[1]?.body as string,
    ) as { input: Array<{ role: string; content: string }> };
    const userPayload = JSON.parse(
      requestBody.input.find((item) => item.role === "user")?.content ?? "{}",
    ) as { candidates: Array<Record<string, unknown>>; searchPlan?: unknown };

    expect(result.relevanceCandidates[0]?.relevanceTier).toBe("primary");
    expect(result.relevanceCandidates[1]?.relevanceTier).toBe("discard");
    expect(userPayload.searchPlan).toBeUndefined();
    expect(userPayload.candidates[0]).toEqual({
      candidateId: "candidate-1",
      title: "Tesla Roadster reveal delayed",
      snippet: "Roadster reveal has been delayed to next month.",
      publishedAt: "2026-04-24T00:00:00.000Z",
      queryPurposes: [],
      publisherName: "Reuters",
      sourceType: "news",
    });
    expect(userPayload.candidates[0]).not.toHaveProperty("canonicalUrl");
    expect(userPayload.candidates[0]).not.toHaveProperty("retrievalBucket");
    expect(userPayload.candidates[0]).not.toHaveProperty("sourceCountryCode");
    expect(result.evidenceSignals).toEqual([
      {
        sourceId: "candidate-1",
        snippetId: null,
        stanceToClaim: "updates",
        temporalRole: "latest_update",
        updateType: "delay",
        currentAnswerImpact: "overrides",
        reason: "최신 연기 보도입니다.",
      },
    ]);
  });
});
