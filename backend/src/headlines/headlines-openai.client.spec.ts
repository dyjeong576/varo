import { HeadlinesOpenAiClient } from "./headlines-openai.client";

function createFetchResponse({
  ok = true,
  status = 200,
  jsonData,
}: {
  ok?: boolean;
  status?: number;
  jsonData?: unknown;
}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(jsonData),
    text: jest.fn().mockResolvedValue(""),
  } as unknown as Response;
}

describe("HeadlinesOpenAiClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("오늘의 요약을 문단과 bullet 형식으로 요청한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    summary:
                      "주요 헤드라인은 같은 사건을 여러 관점에서 다뤘습니다.\n\n- 반복 노출된 이슈를 정리했습니다.\n- 매체별 표현 차이를 비교했습니다.\n- 남은 불확실성을 분리했습니다.",
                    clusters: [],
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new HeadlinesOpenAiClient();
    const result = await client.analyzeHeadlines("openai-test-key", "2026-04-30", "politics", [
      {
        clusterId: "cluster-1",
        representativeTitle: "정치 헤드라인",
        articles: [
          {
            id: "article-1",
            publisherKey: "khan-politics",
            publisherName: "경향신문",
            title: "정치 헤드라인",
          },
        ],
      },
    ]);
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body as string);
    const systemPrompt = requestBody.input[0].content as string;
    const userPayload = JSON.parse(requestBody.input[1].content as string);

    expect(result.summary).toContain("- 반복 노출된 이슈");
    expect(requestBody.text.verbosity).toBe("medium");
    expect(userPayload.clusters[0].articles[0]).toEqual({
      id: "article-1",
      publisherKey: "khan-politics",
      publisherName: "경향신문",
      title: "정치 헤드라인",
    });
    expect(userPayload.clusters[0].articles[0]).not.toHaveProperty("summary");
    expect(userPayload.clusters[0].articles[0]).not.toHaveProperty("url");
    expect(userPayload.clusters[0].articles[0]).not.toHaveProperty("publishedAt");
    expect(systemPrompt).toContain("2~3문장의 개요 문단");
    expect(systemPrompt).toContain("\"- \"로 시작하는 핵심 bullet 3~5개");
    expect(systemPrompt).toContain("매체별 표현 차이");
    expect(systemPrompt).toContain("최종 화면 문구");
    expect(systemPrompt).toContain("데이터 처리 과정");
    expect(systemPrompt).toContain("범위 축소를 요청하는 것은 엄격히 금지");
  });

  it("50개를 초과해도 batch merge 없이 cluster payload를 한 번만 요청한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    summary: "수집된 제목 기준으로 정리했습니다.",
                    clusters: [],
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new HeadlinesOpenAiClient();
    await client.analyzeHeadlines("openai-test-key", "2026-04-30", "politics", Array.from({ length: 51 }, (_, index) => ({
      clusterId: `cluster-${index + 1}`,
      representativeTitle: `정치 헤드라인 ${index + 1}`,
      articles: [
        {
          id: `article-${index + 1}`,
          publisherKey: "khan-politics",
          publisherName: "경향신문",
          title: `정치 헤드라인 ${index + 1}`,
        },
      ],
    })));
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body as string);
    const userPayload = JSON.parse(requestBody.input[1].content as string);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(userPayload.clusters).toHaveLength(51);
    expect(userPayload).not.toHaveProperty("articles");
    expect(userPayload).not.toHaveProperty("batches");
  });

  it("범위 축소 요청형 메타 요약은 저장 전에 대체한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    summary: "입력하신 기사 목록이 매우 방대합니다. 계속 진행하시겠습니까?",
                    clusters: [],
                  }),
                },
              ],
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new HeadlinesOpenAiClient();
    const result = await client.analyzeHeadlines("openai-test-key", "2026-04-30", "politics", []);

    expect(result.summary).toContain("오늘 수집된 헤드라인");
    expect(result.summary).not.toContain("계속 진행");
  });
});
