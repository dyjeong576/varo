import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { getKoreanSearchDomainRegistry } from "../answers.utils";
import { AnswersNaverClient } from "./answers-naver.client";

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

describe("AnswersNaverClient", () => {
  const originalFetch = global.fetch;
  const domainRegistry = getKoreanSearchDomainRegistry();

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("뉴스 검색 응답을 source candidate로 정규화한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          items: [
            {
              title: "<b>테슬라</b> &quot;한국&quot; 철수설",
              originallink: "https://www.yna.co.kr/view/AKR20260401000100001",
              link: "https://n.news.naver.com/mnews/article/001/0010000001",
              description:
                "<b>테슬라</b>가 한국 사업을 유지한다는 설명 &amp; 추가 맥락입니다.",
              pubDate: "Wed, 01 Apr 2026 09:00:00 +0900",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersNaverClient();
    const result = await client.searchNews({
      clientId: "naver-client-id",
      clientSecret: "naver-secret",
      timeoutMs: 40000,
      query: "테슬라 한국 철수",
      queryId: "q2",
      queryPurpose: "check_specific",
      display: 5,
      start: 1,
      sort: "date",
      domainRegistry,
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "naver-q2-c1",
        sourceType: "news",
        publisherName: "연합뉴스",
        canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
        originalUrl: "https://n.news.naver.com/mnews/article/001/0010000001",
        rawTitle: "테슬라 \"한국\" 철수설",
        rawSnippet: "테슬라가 한국 사업을 유지한다는 설명 & 추가 맥락입니다.",
        originQueryIds: ["q2"],
        originQueryPurposes: ["check_specific"],
        retrievalBucket: "familiar",
        domainRegistryId: "kr-centrist-yna",
        sourcePoliticalLean: "centrist",
      }),
    ]);
    expect(result[0]?.publishedAt).toBe(new Date("Wed, 01 Apr 2026 09:00:00 +0900").toISOString());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://openapi.naver.com/v1/search/news.json?"),
      expect.objectContaining({
        method: "GET",
        headers: {
          "X-Naver-Client-Id": "naver-client-id",
          "X-Naver-Client-Secret": "naver-secret",
        },
      }),
    );
    const requestedUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(requestedUrl.searchParams.get("query")).toBe("테슬라 한국 철수");
    expect(requestedUrl.searchParams.get("display")).toBe("5");
    expect(requestedUrl.searchParams.get("start")).toBe("1");
    expect(requestedUrl.searchParams.get("sort")).toBe("date");
  });

  it("whitelist 밖 매체는 후보에서 제외한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        jsonData: {
          items: [
            {
              title: "기사 제목",
              link: "https://n.news.naver.com/mnews/article/001/0010000001",
              description: "기사 설명",
              pubDate: "not-a-date",
            },
            {
              title: "뉴시스 기사 제목",
              originallink: "https://www.newsis.com/view/NISX20260401_0000000001",
              link: "https://n.news.naver.com/mnews/article/003/0010000001",
              description: "기사 설명",
              pubDate: "Wed, 01 Apr 2026 09:00:00 +0900",
            },
          ],
        },
      }),
    ) as typeof fetch;

    const client = new AnswersNaverClient();
    const result = await client.searchNews({
      clientId: "naver-client-id",
      clientSecret: "naver-secret",
      timeoutMs: 40000,
      query: "기사 제목",
      domainRegistry,
    });

    expect(result).toEqual([]);
  });

  it("Naver HTTP 실패를 SOURCE_SEARCH_FAILED로 변환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        ok: false,
        status: 401,
        textData: "authentication failed",
      }),
    ) as typeof fetch;

    const client = new AnswersNaverClient();

    await expect(
      client.searchNews({
        clientId: "bad-client-id",
        clientSecret: "bad-secret",
        timeoutMs: 40000,
        query: "테슬라 한국 철수",
        domainRegistry,
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
      status: 502,
    });
  });

  it("fetch 실패를 SOURCE_SEARCH_FAILED로 변환한다", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network failed"));

    const client = new AnswersNaverClient();

    await expect(
      client.searchNews({
        clientId: "naver-client-id",
        clientSecret: "naver-secret",
        timeoutMs: 40000,
        query: "테슬라 한국 철수",
        domainRegistry,
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
      status: 502,
    });
  });
});
