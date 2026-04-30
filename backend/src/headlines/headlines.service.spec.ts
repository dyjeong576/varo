import { ConfigService } from "@nestjs/config";
import { HeadlinesOpenAiClient } from "./headlines-openai.client";
import { HeadlinesRssParserService } from "./headlines-rss-parser.service";
import { HeadlinesService } from "./headlines.service";

describe("HeadlinesService", () => {
  const createService = () => {
    const db = {
      headlineScrapeRun: {
        create: jest.fn().mockResolvedValue({ id: "run-1" }),
        update: jest.fn().mockResolvedValue({}),
      },
      headlineArticle: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = db as any;
    const service = new HeadlinesService(
      prisma,
      new ConfigService(),
      new HeadlinesRssParserService(),
      {} as HeadlinesOpenAiClient,
    );

    jest.spyOn(service, "generateAnalysis").mockResolvedValue(undefined);

    return { service, db };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("RSS 수집 결과를 createMany skipDuplicates로 저장하고 run count를 기록한다", async () => {
    const { service, db } = createService();
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () => `
        <rss>
          <channel>
            <item>
              <title>정책 헤드라인</title>
              <link>https://news.example.com/a?utm_source=rss</link>
              <description>요약</description>
              <pubDate>Thu, 30 Apr 2026 01:00:00 +0900</pubDate>
            </item>
          </channel>
        </rss>
      `,
    });

    const result = await service.scrapeHeadlines("manual");

    expect(fetchMock).toHaveBeenCalled();
    expect(db.headlineArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "politics",
        }),
        select: { publisherKey: true },
        distinct: ["publisherKey"],
      }),
    );
    expect(db.headlineArticle.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            category: "politics",
          }),
        ]),
        skipDuplicates: true,
      }),
    );
    expect(db.headlineScrapeRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed",
          fetchedCount: expect.any(Number),
          savedCount: 1,
        }),
      }),
    );
    expect(service.generateAnalysis).toHaveBeenCalledWith(result.dateKey, "politics");
    expect(result.savedCount).toBe(1);
  });

  it("category가 economy이면 경제 RSS만 수집한다", async () => {
    const { service, db } = createService();
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () => `
        <rss>
          <channel>
            <item>
              <title>경제 헤드라인</title>
              <link>https://news.example.com/economy</link>
            </item>
          </channel>
        </rss>
      `,
    });

    await service.scrapeHeadlines("manual", "economy");

    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const savedArticles = db.headlineArticle.createMany.mock.calls[0]?.[0]?.data ?? [];
    expect(requestedUrls).toHaveLength(6);
    expect(requestedUrls.every((url) => url.includes("economy"))).toBe(true);
    expect(savedArticles.every((article: { category?: string }) => article.category === "economy")).toBe(true);
    expect(db.headlineScrapeRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "economy",
        }),
      }),
    );
    expect(service.generateAnalysis).toHaveBeenCalledWith(expect.any(String), "economy");
  });

  it("같은 날짜와 category에 이미 수집된 publisherKey는 수동 수집에서 다시 fetch하지 않는다", async () => {
    const { service, db } = createService();
    db.headlineArticle.findMany.mockResolvedValue([
      { publisherKey: "chosun-economy" },
      { publisherKey: "donga-economy" },
      { publisherKey: "yonhap-economy" },
      { publisherKey: "newsis-economy" },
      { publisherKey: "hani-economy" },
      { publisherKey: "khan-economy" },
    ]);
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () => "<rss><channel></channel></rss>",
    });

    const result = await service.scrapeHeadlines("manual", "economy");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.headlineArticle.createMany).not.toHaveBeenCalled();
    expect(service.generateAnalysis).not.toHaveBeenCalled();
    expect(db.headlineScrapeRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed",
          fetchedCount: 0,
          savedCount: 0,
          errorMessage: "6개 매체는 이미 수집되어 건너뛰었습니다.",
        }),
      }),
    );
    expect(result.savedCount).toBe(0);
  });

  it("분석 조회는 dateKey와 category 조합으로 조회한다", async () => {
    const db = {
      headlineAnalysis: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new HeadlinesService(
      db as any,
      new ConfigService(),
      new HeadlinesRssParserService(),
      {} as HeadlinesOpenAiClient,
    );

    const result = await service.getAnalysis("2026-04-30", "economy");

    expect(db.headlineAnalysis.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dateKey_category: {
            dateKey: "2026-04-30",
            category: "economy",
          },
        },
      }),
    );
    expect(result.status).toBe("pending");
  });

  it("헤드라인 조회는 dateKey와 category로 기사 테이블을 필터링한다", async () => {
    const db = {
      headlineArticle: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "article-1",
            dateKey: "2026-04-30",
            category: "economy",
            publisherKey: "khan-economy",
            publisherName: "경향신문",
            feedUrl: "https://www.khan.co.kr/rss/rssdata/economy_news.xml",
            title: "경제 헤드라인",
            url: "https://news.example.com/economy",
            summary: null,
            publishedAt: null,
            scrapedAt: new Date("2026-04-30T00:00:00.000Z"),
          },
        ]),
      },
      headlineScrapeRun: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new HeadlinesService(
      db as any,
      new ConfigService(),
      new HeadlinesRssParserService(),
      {} as HeadlinesOpenAiClient,
    );

    const result = await service.getToday("2026-04-30", "economy");

    expect(db.headlineArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dateKey: "2026-04-30",
          category: "economy",
        },
      }),
    );
    expect(result.publishers.find((publisher) => publisher.publisherKey === "khan-economy")?.articles[0]?.category).toBe("economy");
  });

  it("분석 생성은 dateKey와 category로 기사 테이블을 필터링한다", async () => {
    const db = {
      headlineArticle: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      headlineAnalysis: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new HeadlinesService(
      db as any,
      new ConfigService(),
      new HeadlinesRssParserService(),
      {} as HeadlinesOpenAiClient,
    );

    await service.generateAnalysis("2026-04-30", "economy");

    expect(db.headlineArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dateKey: "2026-04-30",
          category: "economy",
        },
      }),
    );
  });

  it("분석 생성은 제목만으로 로컬 군집화한 cluster 후보를 OpenAI에 전달한다", async () => {
    const articles = [
      {
        id: "article-1",
        publisherKey: "khan-economy",
        publisherName: "경향신문",
        title: "정부, 새 경제 대책 발표",
        url: "https://news.example.com/1",
        summary: "요약 1",
        publishedAt: new Date("2026-04-30T00:00:00.000Z"),
        scrapedAt: new Date("2026-04-30T00:00:00.000Z"),
      },
      {
        id: "article-2",
        publisherKey: "hani-economy",
        publisherName: "한겨레",
        title: "한국은행 기준금리 동결 결정",
        url: "https://news.example.com/2",
        summary: "요약 2",
        publishedAt: new Date("2026-04-30T00:01:00.000Z"),
        scrapedAt: new Date("2026-04-30T00:01:00.000Z"),
      },
      {
        id: "article-3",
        publisherKey: "yonhap-economy",
        publisherName: "연합뉴스",
        title: "정부 새 경제 대책 발표, 세부 내용 공개",
        url: "https://news.example.com/3",
        summary: "요약 3",
        publishedAt: new Date("2026-04-30T00:02:00.000Z"),
        scrapedAt: new Date("2026-04-30T00:02:00.000Z"),
      },
      {
        id: "article-4",
        publisherKey: "newsis-economy",
        publisherName: "뉴시스",
        title: "한국은행 기준금리 동결",
        url: "https://news.example.com/4",
        summary: "요약 4",
        publishedAt: new Date("2026-04-30T00:03:00.000Z"),
        scrapedAt: new Date("2026-04-30T00:03:00.000Z"),
      },
      {
        id: "article-5",
        publisherKey: "chosun-economy",
        publisherName: "조선일보",
        title: "주요 기업 실적 발표 이어져",
        url: "https://news.example.com/5",
        summary: "요약 5",
        publishedAt: new Date("2026-04-30T00:04:00.000Z"),
        scrapedAt: new Date("2026-04-30T00:04:00.000Z"),
      },
    ];
    const db = {
      headlineArticle: {
        findMany: jest.fn().mockResolvedValue(articles),
      },
      headlineAnalysis: {
        upsert: jest.fn().mockResolvedValue({ id: "analysis-1" }),
      },
      $transaction: jest.fn(async (callback) => callback({
        headlineAnalysis: {
          upsert: jest.fn().mockResolvedValue({ id: "analysis-1" }),
        },
        headlineEventCluster: {
          deleteMany: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({ id: "cluster-row-1" }),
        },
        headlineEventClusterItem: {
          createMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
      })),
    };
    const openAiClient = {
      analyzeHeadlines: jest.fn().mockImplementation((_apiKey, _dateKey, _category, clusters) => Promise.resolve({
        summary: "제목 기준 분석입니다.",
        clusters: clusters.map((cluster: any) => ({
          eventName: cluster.representativeTitle,
          eventSummary: "RSS 제목 기준 사건 요약입니다.",
          commonFacts: [],
          uncertainty: null,
          items: cluster.articles.map((article: any) => ({
            articleId: article.id,
            expressionSummary: "RSS 제목 기준 표현입니다.",
            emphasis: null,
            framing: null,
          })),
        })),
      })),
    };
    const service = new HeadlinesService(
      db as any,
      { get: jest.fn().mockReturnValue("openai-test-key") } as any,
      new HeadlinesRssParserService(),
      openAiClient as any,
    );

    await service.generateAnalysis("2026-04-30", "economy");

    const clusters = openAiClient.analyzeHeadlines.mock.calls[0]?.[3];
    expect(openAiClient.analyzeHeadlines).toHaveBeenCalledTimes(1);
    expect(clusters).toHaveLength(3);
    expect(clusters.map((cluster: any) => cluster.articles.map((article: any) => article.id))).toEqual([
      ["article-1", "article-3"],
      ["article-2", "article-4"],
      ["article-5"],
    ]);
    expect(clusters[0].articles[0]).toEqual({
      id: "article-1",
      publisherKey: "khan-economy",
      publisherName: "경향신문",
      title: "정부, 새 경제 대책 발표",
    });
    expect(clusters[0].articles[0]).not.toHaveProperty("summary");
    expect(clusters[0].articles[0]).not.toHaveProperty("url");
    expect(clusters[0].articles[0]).not.toHaveProperty("publishedAt");
  });
});
