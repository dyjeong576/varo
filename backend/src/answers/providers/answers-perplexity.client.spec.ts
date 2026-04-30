import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AnswersPerplexityClient } from "./answers-perplexity.client";

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

describe("AnswersPerplexityClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("structured answer와 검색 출처 메타데이터를 직접 답변 결과로 변환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  answer: "2026년 기준 최저임금은 시간당 1만320원입니다.",
                }),
              },
              finish_reason: "stop",
            },
          ],
          citations: ["https://www.minimumwage.go.kr/main.do"],
          search_results: [
            {
              title: "최저임금위원회",
              url: "https://www.minimumwage.go.kr/main.do",
              date: "2026-01-01",
              snippet: "2026년 적용 최저임금 안내",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersPerplexityClient();
    const result = await client.answerDirectly(
      "perplexity-test-key",
      "2026년 최저임금 얼마야?",
    );
    const requestBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0]?.[1]?.body as string,
    );

    expect(requestBody.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "direct_answer" },
    });
    expect(requestBody.web_search_options).toMatchObject({
      search_mode: "web",
      search_context_size: "low",
      return_images: false,
      return_related_questions: false,
    });
    expect(requestBody.reasoning_effort).toBe("low");
    expect(result.answerText).toBe("2026년 기준 최저임금은 시간당 1만320원입니다.");
    expect(result.citations).toEqual([
      {
        url: "https://www.minimumwage.go.kr/main.do",
        title: "최저임금위원회",
        publishedAt: "2026-01-01T00:00:00.000Z",
        snippet: "2026년 적용 최저임금 안내",
      },
    ]);
  });

  it("Perplexity 응답이 JSON이 아니면 schema error로 실패시킨다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          choices: [
            {
              message: {
                role: "assistant",
                content: "2026년 기준 최저임금은 시간당 1만320원입니다.",
              },
              finish_reason: "stop",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersPerplexityClient();

    await expect(
      client.answerDirectly("perplexity-test-key", "2026년 최저임금 얼마야?"),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      status: HttpStatus.BAD_GATEWAY,
    });
  });

  it("query refinement structured output을 search plan 결과로 변환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  coreCheck: "한국은행 기준금리 동결",
                  normalizedCheck: "한국은행이 기준금리를 동결했다",
                  checkType: "policy",
                  isFactCheckQuestion: true,
                  searchRoute: "supported",
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
                        purpose: "current_state",
                        query: "기준금리 현재",
                        priority: 2,
                      },
                      {
                        id: "sp3",
                        purpose: "primary_source",
                        query: "한국은행 공식 발표",
                        priority: 3,
                      },
                      {
                        id: "sp4",
                        purpose: "contradiction_or_update",
                        query: "기준금리 정정 번복",
                        priority: 4,
                      },
                    ],
                  },
                }),
              },
              finish_reason: "stop",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersPerplexityClient();
    const result = await client.refineQuery(
      "perplexity-test-key",
      "한국은행이 기준금리 동결했대",
    );
    const requestBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0]?.[1]?.body as string,
    );

    expect(requestBody.max_tokens).toBe(1000);
    expect(requestBody.web_search_options).toEqual({
      disable_search: true,
      search_context_size: "low",
    });
    expect(requestBody.reasoning_effort).toBe("low");
    expect(result.searchRoute).toBe("supported");
    expect(result.searchPlan.queries.map((query) => query.purpose)).toEqual([
      "check_specific",
      "current_state",
      "primary_source",
      "contradiction_or_update",
    ]);
  });

  it("relevance와 evidence signal structured output을 함께 변환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
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
              finish_reason: "stop",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersPerplexityClient();
    const result = await client.classifyRelevanceAndEvidenceSignals(
      "perplexity-test-key",
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
        ],
      },
    );

    expect(result.relevanceCandidates[0]?.relevanceTier).toBe("primary");
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
    expect(result.answerSummary?.uncertaintyItems).toEqual([
      "검색 결과 스니펫 중심의 검토입니다.",
    ]);
  });
});
