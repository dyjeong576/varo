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
        id: "article-1",
        publisherKey: "khan-politics",
        publisherName: "경향신문",
        title: "정치 헤드라인",
        url: "https://news.example.com/article-1",
        summary: "정치 헤드라인 요약",
        publishedAt: null,
      },
    ]);
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body as string);
    const systemPrompt = requestBody.input[0].content as string;

    expect(result.summary).toContain("- 반복 노출된 이슈");
    expect(requestBody.text.verbosity).toBe("medium");
    expect(systemPrompt).toContain("2~3문장의 개요 문단");
    expect(systemPrompt).toContain("\"- \"로 시작하는 핵심 bullet 3~5개");
    expect(systemPrompt).toContain("매체별 표현 차이");
  });
});
