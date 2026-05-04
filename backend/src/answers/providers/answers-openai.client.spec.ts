import { AnswersOpenAiClient } from "./answers-openai.client";

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

describe("AnswersOpenAiClient", () => {
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
                    coreCheck: "트럼프의 관세 발표",
                    normalizedCheck: "트럼프가 관세를 발표했다",
                    checkType: "policy",
                    answerMode: "fact_check",
                    searchRoute: "unsupported",
                    searchRouteReason:
                      "미국 관세 발표를 다루는 해외/글로벌 뉴스성 check입니다. VARO가 현재 한국 뉴스만 분석한다.",
                    searchPlan: {
                      queries: [],
                    },
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersOpenAiClient();
    const result = await client.refineQuery(
      "openai-test-key",
      "트럼프가 오늘 관세 발표했대",
    );

    expect(result.searchRoute).toBe("unsupported");
    expect(result.normalizedCheck).toBe("트럼프가 관세를 발표했다");
    expect(result.checkType).toBe("policy");
    expect(result.searchPlan.queries).toEqual([]);
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
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("사실성 검토 대상이 아닌 질문은 direct answer mode로 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    coreCheck: "정치 뉴스 읽는 방법",
                    normalizedCheck: "정치 뉴스를 어떻게 읽어야 하는지 묻는 질문",
                    checkType: "general_fact",
                    answerMode: "direct_answer",
                    searchRoute: "unsupported",
                    searchPlan: {
                      queries: [],
                    },
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersOpenAiClient();
    const result = await client.refineQuery(
      "openai-test-key",
      "정치 뉴스는 어떻게 읽는 게 좋아?",
    );

    expect(result.answerMode).toBe("direct_answer");
    expect(result.searchRoute).toBe("unsupported");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("한국 정치·경제 설명형 질문은 context answer mode와 search plan을 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    coreCheck: "부동산 정책 논란 배경",
                    normalizedCheck: "부동산 정책이 논란이 되는 배경",
                    checkType: "policy",
                    answerMode: "context_answer_with_news",
                    searchRoute: "supported",
                    searchPlan: {
                      queries: [
                        {
                          id: "sp1",
                          purpose: "check_specific",
                          query: "부동산 정책 논란",
                          priority: 1,
                        },
                        {
                          id: "sp2",
                          purpose: "current_state",
                          query: "부동산 정책 현재 쟁점",
                          priority: 2,
                        },
                        {
                          id: "sp3",
                          purpose: "primary_source",
                          query: "부동산 정책 공식 발표",
                          priority: 3,
                        },
                        {
                          id: "sp4",
                          purpose: "contradiction_or_update",
                          query: "부동산 정책 반박 정정",
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

    const client = new AnswersOpenAiClient();
    const result = await client.refineQuery(
      "openai-test-key",
      "부동산 정책이 왜 논란이야?",
    );

    expect(result.answerMode).toBe("context_answer_with_news");
    expect(result.searchRoute).toBe("supported");
    expect(result.searchPlan.queries).toHaveLength(4);
    const requestBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0]?.[1]?.body as string,
    ) as { input: Array<{ content: string }> };
    const systemPrompt = requestBody.input[0]?.content ?? "";
    expect(systemPrompt).toContain("뉴스 검색 의도로 변환");
    expect(systemPrompt).toContain("질문어·요청어는 제거");
    expect(systemPrompt).toContain("고유명사, 사건·행위, 정책·제도, 수치·발표, 쟁점·결과");
    expect(systemPrompt).toContain("정확 사건, 최신 쟁점, 공식/원출처, 반박/해명/후속 보도");
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
                    coreCheck: "한국 기준금리 동결",
                    normalizedCheck: "한국은행이 기준금리를 동결했다",
                    checkType: "policy",
                    answerMode: "fact_check",
                    searchRoute: "supported",
                    searchRouteReason:
                      "한국 경제 정책 관련 뉴스성 check입니다.",
                    searchPlan: {
                      queries: [
                        {
                          id: "sp1",
                          purpose: "check_specific",
                          query: "한국은행 기준금리 동결",
                          priority: 1,
                        },
                        {
                          id: "sp2",
                          purpose: "check_specific",
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
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersOpenAiClient();
    const result = await client.refineQuery(
      "openai-test-key",
      "한국은행이 기준금리 동결했대",
    );

    expect(result.searchPlan.queries.map((query) => query.purpose)).toEqual([
      "check_specific",
      "current_state",
      "primary_source",
      "contradiction_or_update",
    ]);
    expect(result.answerMode).toBe("fact_check");
    // sp2는 check_specific 중복이므로 버려지고 current_state는 fallback 쿼리(coreCheck, index=1)로 채워진다
    expect(result.searchPlan.queries[1]?.query).toBe(
      "한국 기준금리 동결",
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("check의 관할과 장소가 한국 정치 맥락이면 supported route로 유지한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    coreCheck: "일론 머스크의 부산 국회의원 출마",
                    normalizedCheck: "일론 머스크가 부산에서 국회의원에 출마한다",
                    checkType: "scheduled_event",
                    answerMode: "fact_check",
                    searchRoute: "supported",
                    searchPlan: {
                      queries: [
                        {
                          id: "sp1",
                          purpose: "check_specific",
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

    const client = new AnswersOpenAiClient();
    const result = await client.refineQuery(
      "openai-test-key",
      "일론머스크가 부산 국회의원 출마한다는게 사실이야?",
    );

    expect(result.searchRoute).toBe("supported");
    expect(result.searchPlan.queries).toHaveLength(4);
  });

  it("해외 기업명으로 시작해도 한국 시장 영향 check이면 supported route로 유지한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    coreCheck: "해외 기업의 한국 서비스 종료",
                    normalizedCheck: "해외 기업이 한국에서 서비스를 종료한다",
                    checkType: "corporate_action",
                    answerMode: "fact_check",
                    searchRoute: "supported",
                    searchPlan: {
                      queries: [
                        {
                          id: "sp1",
                          purpose: "check_specific",
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

    const client = new AnswersOpenAiClient();
    const result = await client.refineQuery(
      "openai-test-key",
      "어떤 해외 기업이 한국 서비스 접는다는 게 사실이야?",
    );

    expect(result.searchRoute).toBe("supported");
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
                        stanceToCheck: "updates",
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

    const client = new AnswersOpenAiClient();
    const result = await client.classifyEvidenceSignals("openai-test-key", {
      coreCheck: "테슬라가 2026년 4월에 로드스터 차량을 공개한다",
      searchPlan: {
        queries: [
          { id: "q1", purpose: "check_specific", query: "Tesla Roadster April 2026", priority: 1 },
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
        stanceToCheck: "updates",
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
                        stanceToCheck: "updates",
                        temporalRole: "latest_update",
                        updateType: "delay",
                        currentAnswerImpact: "overrides",
                      },
                      {
                        candidateId: "candidate-2",
                        relevanceTier: "discard",
                        relevanceReason: "check 검토와 직접 관련이 낮습니다.",
                        stanceToCheck: "unknown",
                        temporalRole: "background",
                        updateType: "none",
                        currentAnswerImpact: "neutral",
                      },
                    ],
                    answerSummary: {
                      analysisSummary:
                        "수집된 출처 기준으로는 최신 보도에서 일정 연기 신호가 확인됩니다.",
                      uncertaintySummary:
                        "공식 원문 확인 여부에 따라 해석이 달라질 수 있습니다.",
                      uncertaintyItems: ["검색 결과 스니펫 중심의 검토입니다."],
                    },
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersOpenAiClient();
    const result = await client.classifyRelevanceAndEvidenceSignals(
      "openai-test-key",
      {
        coreCheck: "테슬라가 2026년 4월에 로드스터 차량을 공개한다",
        searchRoute: "supported",
        searchPlan: null,
        candidates: [
          {
            id: "candidate-1",
            searchRoute: "supported",
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
            domainRegistryId: "kr-verification",
          },
          {
            id: "candidate-2",
            searchRoute: "supported",
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
    expect(result.evidenceSignals).toEqual([
      {
        sourceId: "candidate-1",
        snippetId: null,
        stanceToCheck: "updates",
        temporalRole: "latest_update",
        updateType: "delay",
        currentAnswerImpact: "overrides",
        reason: "최신 연기 보도입니다.",
      },
    ]);
    expect(result.answerSummary?.analysisSummary).toContain("최신 보도");
  });
});
