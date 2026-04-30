import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { buildCanonicalUrl, buildNormalizedHash } from "../answers/answers.utils";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { PrismaService } from "../prisma/prisma.service";
import { HEADLINE_FEEDS, HeadlineFeedConfig } from "./headlines.feeds";
import { HeadlinesOpenAiClient } from "./headlines-openai.client";
import { HeadlinesRssParserService } from "./headlines-rss-parser.service";
import {
  HeadlinesAnalysisResponseDto,
  HeadlinesTodayResponseDto,
} from "./dto/headlines-response.dto";
import {
  HeadlineAnalysisArticleInput,
  HeadlineAnalysisPayload,
  HeadlineCategory,
  HeadlineScrapeTrigger,
  ParsedHeadlineItem,
} from "./headlines.types";

const RSS_FETCH_TIMEOUT_MS = 12000;
const MAX_ARTICLES_PER_FEED = 30;
const MAX_ANALYSIS_ARTICLES = 120;
const RSS_FETCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HEADLINE_FEED_BY_KEY = new Map(HEADLINE_FEEDS.map((feed) => [feed.publisherKey, feed]));

@Injectable()
export class HeadlinesService {
  private readonly logger = new Logger(HeadlinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly parser: HeadlinesRssParserService,
    private readonly openAiClient: HeadlinesOpenAiClient,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  getDateKey(value?: string): string {
    if (value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new AppException(
          APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
          "date는 YYYY-MM-DD 형식이어야 합니다.",
          HttpStatus.BAD_REQUEST,
        );
      }

      return value;
    }

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  async scrapeHeadlines(trigger: HeadlineScrapeTrigger, category?: string): Promise<{ dateKey: string; fetchedCount: number; savedCount: number }> {
    const dateKey = this.getDateKey();
    const feeds = this.getFeeds(category);
    const run = await this.db.headlineScrapeRun.create({
      data: {
        dateKey,
        status: "running",
        trigger,
      },
    });

    try {
      const settled = await Promise.allSettled(
        feeds.map((feed) => this.fetchFeed(feed)),
      );
      const articles = settled.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
      const failedFeeds = settled.filter((result) => result.status === "rejected");

      if (failedFeeds.length > 0) {
        this.logger.warn(`headline rss partial failure; failedFeeds=${failedFeeds.length}`);
      }

      const createResult = articles.length > 0
        ? await this.db.headlineArticle.createMany({
            data: articles.map((article) => ({
              ...article,
              dateKey,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

      await this.db.headlineScrapeRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          finishedAt: new Date(),
          fetchedCount: articles.length,
          savedCount: createResult.count,
          errorMessage: failedFeeds.length > 0 ? `${failedFeeds.length}개 RSS 수집에 실패했습니다.` : null,
        },
      });

      await this.generateAnalysis(dateKey);

      return {
        dateKey,
        fetchedCount: articles.length,
        savedCount: createResult.count,
      };
    } catch (error) {
      await this.db.headlineScrapeRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "unknown error",
        },
      });
      throw error;
    }
  }

  async getToday(date?: string, category?: string): Promise<HeadlinesTodayResponseDto> {
    const dateKey = this.getDateKey(date);
    const feeds = this.getFeeds(category);
    const publisherKeys = feeds.map((feed) => feed.publisherKey);
    const [articles, lastScrapeRun] = await Promise.all([
      this.db.headlineArticle.findMany({
        where: {
          dateKey,
          publisherKey: { in: publisherKeys },
        },
        orderBy: [
          { publisherName: "asc" },
          { publishedAt: "desc" },
          { scrapedAt: "desc" },
        ],
      }),
      this.db.headlineScrapeRun.findFirst({
        where: { dateKey },
        orderBy: { startedAt: "desc" },
      }),
    ]);

    const byPublisher = this.createPublisherGroups(feeds);

    for (const article of articles) {
      const group = byPublisher.get(article.publisherKey) ?? {
        publisherKey: article.publisherKey,
        publisherName: article.publisherName,
        category: this.getCategoryForPublisher(article.publisherKey),
        feedUrl: article.feedUrl,
        articles: [],
      };

      group.articles.push({
        id: article.id,
        publisherKey: article.publisherKey,
        publisherName: article.publisherName,
        category: this.getCategoryForPublisher(article.publisherKey),
        title: article.title,
        url: article.url,
        summary: article.summary,
        publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString() : null,
      });
      byPublisher.set(article.publisherKey, group);
    }

    return {
      dateKey,
      totalArticleCount: articles.length,
      lastScrapeRun: lastScrapeRun
        ? {
            status: lastScrapeRun.status,
            trigger: lastScrapeRun.trigger,
            startedAt: lastScrapeRun.startedAt.toISOString(),
            finishedAt: lastScrapeRun.finishedAt ? lastScrapeRun.finishedAt.toISOString() : null,
            fetchedCount: lastScrapeRun.fetchedCount,
            savedCount: lastScrapeRun.savedCount,
            errorMessage: lastScrapeRun.errorMessage,
          }
        : null,
      publishers: [...byPublisher.values()],
    };
  }

  async getLive(category?: string): Promise<HeadlinesTodayResponseDto> {
    const dateKey = this.getDateKey();
    const feeds = this.getFeeds(category);
    const settled = await Promise.allSettled(
      feeds.map((feed) => this.fetchFeed(feed)),
    );
    const articles = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const failedFeeds = settled.filter((result) => result.status === "rejected");
    const byPublisher = this.createPublisherGroups(feeds);

    if (failedFeeds.length > 0) {
      this.logger.warn(`headline live rss partial failure; failedFeeds=${failedFeeds.length}`);
    }

    for (const article of articles) {
      const group = byPublisher.get(article.publisherKey) ?? {
        publisherKey: article.publisherKey,
        publisherName: article.publisherName,
        category: this.getCategoryForPublisher(article.publisherKey),
        feedUrl: article.feedUrl,
        articles: [],
      };

      group.articles.push({
        id: article.normalizedHash,
        publisherKey: article.publisherKey,
        publisherName: article.publisherName,
        category: this.getCategoryForPublisher(article.publisherKey),
        title: article.title,
        url: article.url,
        summary: article.summary ?? null,
        publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString() : null,
      });
      byPublisher.set(article.publisherKey, group);
    }

    return {
      dateKey,
      totalArticleCount: articles.length,
      lastScrapeRun: {
        status: failedFeeds.length > 0 ? "partial" : "live",
        trigger: "live",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        fetchedCount: articles.length,
        savedCount: 0,
        errorMessage: failedFeeds.length > 0 ? `${failedFeeds.length}개 RSS 실시간 조회에 실패했습니다.` : null,
      },
      publishers: [...byPublisher.values()],
    };
  }

  async getAnalysis(date?: string, category?: string): Promise<HeadlinesAnalysisResponseDto> {
    const dateKey = this.getDateKey(date);
    const normalizedCategory = this.normalizeCategory(category);
    const analysis = await this.db.headlineAnalysis.findUnique({
      where: { dateKey },
      include: {
        clusters: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: true,
          },
        },
      },
    });

    if (!analysis) {
      return {
        dateKey,
        status: "pending",
        summary: null,
        errorMessage: null,
        clusters: [],
      };
    }

    return {
      dateKey,
      status: analysis.status,
      summary: analysis.summary,
      errorMessage: analysis.errorMessage,
      clusters: analysis.clusters
        .map((cluster) => {
          const items = cluster.items
            .filter((item) => !normalizedCategory || this.getCategoryForPublisher(item.publisherKey) === normalizedCategory)
            .map((item) => ({
              articleId: item.articleId,
              publisherKey: item.publisherKey,
              publisherName: item.publisherName,
              articleTitle: item.articleTitle,
              articleUrl: item.articleUrl,
              expressionSummary: item.expressionSummary,
              emphasis: item.emphasis,
              framing: item.framing,
            }));

          return {
            id: cluster.id,
            eventName: cluster.eventName,
            eventSummary: cluster.eventSummary,
            commonFacts: this.readStringArray(cluster.commonFacts),
            uncertainty: cluster.uncertainty,
            items,
          };
        })
        .filter((cluster) => !normalizedCategory || cluster.items.length > 0),
    };
  }

  async generateAnalysis(dateKey: string): Promise<void> {
    const articles = await this.db.headlineArticle.findMany({
      where: { dateKey },
      orderBy: [
        { publishedAt: "desc" },
        { scrapedAt: "desc" },
      ],
      take: MAX_ANALYSIS_ARTICLES,
    });

    if (articles.length === 0) {
      await this.upsertFailedAnalysis(dateKey, "분석할 헤드라인이 없습니다.");
      return;
    }

    await this.db.headlineAnalysis.upsert({
      where: { dateKey },
      create: { dateKey, status: "pending" },
      update: { status: "pending", errorMessage: null },
    });

    try {
      const payload = await this.buildAnalysisPayload(
        dateKey,
        articles.map((article) => ({
          id: article.id,
          publisherKey: article.publisherKey,
          publisherName: article.publisherName,
          title: article.title,
          url: article.url,
          summary: article.summary,
          publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
        })),
      );

      await this.persistAnalysis(dateKey, payload, articles);
    } catch (error) {
      await this.upsertFailedAnalysis(
        dateKey,
        error instanceof Error ? error.message : "헤드라인 분석에 실패했습니다.",
      );
    }
  }

  private async fetchFeed(feed: HeadlineFeedConfig): Promise<Array<Omit<Prisma.HeadlineArticleCreateManyInput, "dateKey">>> {
    const response = await fetch(feed.feedUrl, {
      signal: AbortSignal.timeout(RSS_FETCH_TIMEOUT_MS),
      headers: {
        "accept": "application/rss+xml, application/xml, text/xml, */*",
        "user-agent": RSS_FETCH_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`${feed.publisherName} RSS 응답 오류: ${response.status}`);
    }

    const items = this.parser.parse(await response.text()).slice(0, MAX_ARTICLES_PER_FEED);

    return items.map((item) => this.toArticleCreateInput(feed, item));
  }

  private createPublisherGroups(feeds = HEADLINE_FEEDS): Map<string, HeadlinesTodayResponseDto["publishers"][number]> {
    const byPublisher = new Map<string, HeadlinesTodayResponseDto["publishers"][number]>();

    for (const feed of feeds) {
      byPublisher.set(feed.publisherKey, {
        publisherKey: feed.publisherKey,
        publisherName: feed.publisherName,
        category: feed.category,
        feedUrl: feed.feedUrl,
        articles: [],
      });
    }

    return byPublisher;
  }

  private toArticleCreateInput(
    feed: HeadlineFeedConfig,
    item: ParsedHeadlineItem,
  ): Omit<Prisma.HeadlineArticleCreateManyInput, "dateKey"> {
    const normalizedUrl = buildCanonicalUrl(item.url);

    return {
      publisherKey: feed.publisherKey,
      publisherName: feed.publisherName,
      feedUrl: feed.feedUrl,
      title: item.title,
      url: item.url,
      summary: item.summary,
      publishedAt: item.publishedAt,
      normalizedUrl,
      normalizedHash: buildNormalizedHash(normalizedUrl),
      rawItem: item.rawItem as Prisma.InputJsonValue,
    };
  }

  private async buildAnalysisPayload(
    dateKey: string,
    articles: HeadlineAnalysisArticleInput[],
  ): Promise<HeadlineAnalysisPayload> {
    const providerMode = this.configService.get<string>("answerProviderMode", "mock");
    const apiKey = this.configService.get<string | null>("openAiApiKey", null);

    if (providerMode === "mock") {
      return this.buildMockAnalysis(articles);
    }

    if (!apiKey) {
      throw new AppException(
        APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
        "헤드라인 분석에는 OPENAI_API_KEY가 필요합니다.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.openAiClient.analyzeHeadlines(apiKey, dateKey, articles);
  }

  private buildMockAnalysis(articles: HeadlineAnalysisArticleInput[]): HeadlineAnalysisPayload {
    const selected = articles.slice(0, 8);

    return {
      summary: "개발 모드에서는 RSS 제목과 요약을 기준으로 임시 사건 묶음을 생성합니다.",
      clusters: selected.length > 0
        ? [
            {
              eventName: "오늘 수집된 주요 헤드라인",
              eventSummary: "수집된 RSS 헤드라인을 하나의 임시 묶음으로 비교합니다.",
              commonFacts: ["RSS 제목과 요약만 사용했습니다."],
              uncertainty: "실제 사건별 군집화는 real provider mode에서 OpenAI 분석으로 생성됩니다.",
              items: selected.map((article) => ({
                articleId: article.id,
                expressionSummary: `${article.publisherName}은 "${article.title}"로 이 사안을 표현했습니다.`,
                emphasis: article.summary ? article.summary.slice(0, 120) : null,
                framing: null,
              })),
            },
          ]
        : [],
    };
  }

  private async persistAnalysis(
    dateKey: string,
    payload: HeadlineAnalysisPayload,
    articles: Array<{ id: string; publisherKey: string; publisherName: string; title: string; url: string }>,
  ): Promise<void> {
    const articleMap = new Map(articles.map((article) => [article.id, article]));

    await this.db.$transaction(async (tx: any) => {
      const analysis = await tx.headlineAnalysis.upsert({
        where: { dateKey },
        create: {
          dateKey,
          status: "ready",
          summary: payload.summary,
          errorMessage: null,
        },
        update: {
          status: "ready",
          summary: payload.summary,
          errorMessage: null,
        },
      });

      await tx.headlineEventCluster.deleteMany({
        where: { analysisId: analysis.id },
      });

      for (const [index, cluster] of payload.clusters.entries()) {
        const createdCluster = await tx.headlineEventCluster.create({
          data: {
            analysisId: analysis.id,
            eventName: cluster.eventName,
            eventSummary: cluster.eventSummary,
            commonFacts: cluster.commonFacts,
            uncertainty: cluster.uncertainty,
            sortOrder: index,
          },
        });

        const items = cluster.items
          .map((item) => {
            const article = articleMap.get(item.articleId);

            if (!article) {
              return null;
            }

            return {
              clusterId: createdCluster.id,
              articleId: article.id,
              publisherKey: article.publisherKey,
              publisherName: article.publisherName,
              articleTitle: article.title,
              articleUrl: article.url,
              expressionSummary: item.expressionSummary,
              emphasis: item.emphasis,
              framing: item.framing,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (items.length > 0) {
          await tx.headlineEventClusterItem.createMany({ data: items });
        }
      }
    });
  }

  private async upsertFailedAnalysis(dateKey: string, errorMessage: string): Promise<void> {
    await this.db.headlineAnalysis.upsert({
      where: { dateKey },
      create: {
        dateKey,
        status: "failed",
        errorMessage,
      },
      update: {
        status: "failed",
        errorMessage,
      },
    });
  }

  private readStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  }

  private getCategoryForPublisher(publisherKey: string): "politics" | "economy" {
    return HEADLINE_FEED_BY_KEY.get(publisherKey)?.category ?? (publisherKey.endsWith("-economy") ? "economy" : "politics");
  }

  private getFeeds(category?: string): HeadlineFeedConfig[] {
    const normalizedCategory = this.normalizeCategory(category);

    return normalizedCategory
      ? HEADLINE_FEEDS.filter((feed) => feed.category === normalizedCategory)
      : HEADLINE_FEEDS;
  }

  private normalizeCategory(category?: string): HeadlineCategory | undefined {
    if (!category) {
      return undefined;
    }

    if (category === "politics" || category === "economy") {
      return category;
    }

    throw new AppException(
      APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
      "category는 politics 또는 economy만 사용할 수 있습니다.",
      HttpStatus.BAD_REQUEST,
    );
  }
}
