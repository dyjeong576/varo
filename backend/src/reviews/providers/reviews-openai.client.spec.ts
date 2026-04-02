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
                    topicScope: "foreign",
                    topicCountryCode: "US",
                    countryDetectionReason: "미국 이슈로 판단했습니다.",
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
    expect(result.generatedQueries).toHaveLength(3);
  });
});
