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
    expect(db.headlineArticle.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
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
    expect(requestedUrls).toHaveLength(6);
    expect(requestedUrls.every((url) => url.includes("economy"))).toBe(true);
    expect(db.headlineScrapeRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "economy",
        }),
      }),
    );
    expect(service.generateAnalysis).toHaveBeenCalledWith(expect.any(String), "economy");
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
});
