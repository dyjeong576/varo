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
  HeadlineAnalysisClusterInput,
  HeadlineAnalysisPayload,
  HeadlineCategory,
  HeadlineScrapeTrigger,
  ParsedHeadlineItem,
} from "./headlines.types";

const RSS_FETCH_TIMEOUT_MS = 12000;
const MAX_ARTICLES_PER_FEED = 30;
const RSS_FETCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HEADLINE_FEED_BY_KEY = new Map(HEADLINE_FEEDS.map((feed) => [feed.publisherKey, feed]));
const HEADLINE_CLUSTER_SIMILARITY_THRESHOLD = 0.42;

interface HeadlineTitleSignature {
  tokens: Set<string>;
  bigrams: Set<string>;
}

type HeadlineClusterDraft = HeadlineAnalysisClusterInput & {
  sortIndex: number;
  signatures: HeadlineTitleSignature[];
};

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
    const normalizedCategory = this.normalizeCategory(category) ?? "politics";
    const feeds = this.getFeeds(normalizedCategory);
    const run = await this.db.headlineScrapeRun.create({
      data: {
        dateKey,
        category: normalizedCategory,
        status: "running",
        trigger,
      },
    });

    try {
      const existingPublishers = await this.db.headlineArticle.findMany({
        where: { dateKey, category: normalizedCategory },
        select: { publisherKey: true },
        distinct: ["publisherKey"],
      });
      const existingPublisherKeys = new Set(existingPublishers.map((article: { publisherKey: string }) => article.publisherKey));
      const feedsToFetch = feeds.filter((feed) => !existingPublisherKeys.has(feed.publisherKey));
      const skippedFeedCount = feeds.length - feedsToFetch.length;
      const settled = await Promise.allSettled(
        feedsToFetch.map((feed) => this.fetchFeed(feed)),
      );
      const articles = settled.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
      const failedFeeds = settled.filter((result) => result.status === "rejected");
      const runMessages: string[] = [];

      if (failedFeeds.length > 0) {
        this.logger.warn(`headline rss partial failure; failedFeeds=${failedFeeds.length}`);
        runMessages.push(`${failedFeeds.length}개 RSS 수집에 실패했습니다.`);
      }

      if (skippedFeedCount > 0) {
        runMessages.push(`${skippedFeedCount}개 매체는 이미 수집되어 건너뛰었습니다.`);
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
          errorMessage: runMessages.length > 0 ? runMessages.join(" ") : null,
        },
      });

      if (articles.length > 0) {
        await this.generateAnalysis(dateKey, normalizedCategory);
      }

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
    const normalizedCategory = this.normalizeCategory(category);
    const feeds = this.getFeeds(normalizedCategory);
    const [articles, lastScrapeRun] = await Promise.all([
      this.db.headlineArticle.findMany({
        where: normalizedCategory ? { dateKey, category: normalizedCategory } : { dateKey },
        orderBy: [
          { publisherName: "asc" },
          { publishedAt: "desc" },
          { scrapedAt: "desc" },
        ],
      }),
      this.db.headlineScrapeRun.findFirst({
        where: normalizedCategory ? { dateKey, category: normalizedCategory } : { dateKey },
        orderBy: { startedAt: "desc" },
      }),
    ]);

    const byPublisher = this.createPublisherGroups(feeds);

    for (const article of articles) {
      const group = byPublisher.get(article.publisherKey) ?? {
        publisherKey: article.publisherKey,
        publisherName: article.publisherName,
        category: article.category,
        feedUrl: article.feedUrl,
        articles: [],
      };

      group.articles.push({
        id: article.id,
        publisherKey: article.publisherKey,
        publisherName: article.publisherName,
        category: article.category,
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
            category: lastScrapeRun.category,
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
    const normalizedCategory = this.normalizeCategory(category);
    const feeds = this.getFeeds(normalizedCategory);
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
        category: article.category ?? this.getCategoryForPublisher(article.publisherKey),
        feedUrl: article.feedUrl,
        articles: [],
      };

      group.articles.push({
        id: article.normalizedHash,
        publisherKey: article.publisherKey,
        publisherName: article.publisherName,
        category: article.category ?? this.getCategoryForPublisher(article.publisherKey),
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
        category: normalizedCategory ?? "politics",
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
    const normalizedCategory = this.normalizeCategory(category) ?? "politics";
    const analysis = await this.db.headlineAnalysis.findUnique({
      where: { dateKey_category: { dateKey, category: normalizedCategory } },
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
        .filter((cluster) => cluster.items.length > 0),
    };
  }

  async generateAnalysis(dateKey: string, category: HeadlineCategory): Promise<void> {
    const articles = await this.db.headlineArticle.findMany({
      where: {
        dateKey,
        category,
      },
      orderBy: [
        { publishedAt: "desc" },
        { scrapedAt: "desc" },
      ],
    });

    if (articles.length === 0) {
      await this.upsertFailedAnalysis(dateKey, category, "분석할 헤드라인이 없습니다.");
      return;
    }

    await this.db.headlineAnalysis.upsert({
      where: { dateKey_category: { dateKey, category } },
      create: { dateKey, category, status: "pending" },
      update: { status: "pending", errorMessage: null },
    });

    try {
      const payload = await this.buildAnalysisPayload(
        dateKey,
        category,
        this.createTitleClusters(
          articles.map((article) => ({
            id: article.id,
            publisherKey: article.publisherKey,
            publisherName: article.publisherName,
            title: article.title,
          })),
        ),
      );

      await this.persistAnalysis(dateKey, category, this.normalizeAnalysisPayload(payload, articles), articles);
    } catch (error) {
      await this.upsertFailedAnalysis(
        dateKey,
        category,
        error instanceof Error ? error.message : "헤드라인 분석에 실패했습니다.",
      );
    }
  }

  async regenerateAnalysis(date?: string, category?: string): Promise<{ dateKey: string; category: HeadlineCategory; status: string; errorMessage: string | null }> {
    const dateKey = this.getDateKey(date);
    const normalizedCategory = this.normalizeCategory(category) ?? "politics";

    await this.generateAnalysis(dateKey, normalizedCategory);

    const analysis = await this.db.headlineAnalysis.findUnique({
      where: { dateKey_category: { dateKey, category: normalizedCategory } },
      select: { status: true, errorMessage: true },
    });

    return {
      dateKey,
      category: normalizedCategory,
      status: analysis?.status ?? "pending",
      errorMessage: analysis?.errorMessage ?? null,
    };
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
      category: feed.category,
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
    category: HeadlineCategory,
    clusters: HeadlineAnalysisClusterInput[],
  ): Promise<HeadlineAnalysisPayload> {
    const apiKey = this.configService.get<string | null>("openAiApiKey", null);

    if (!apiKey) {
      throw new AppException(
        APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
        "헤드라인 분석에는 OPENAI_API_KEY가 필요합니다.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.openAiClient.analyzeHeadlines(apiKey, dateKey, category, clusters);
  }

  private createTitleClusters(articles: HeadlineAnalysisArticleInput[]): HeadlineAnalysisClusterInput[] {
    const clusters: HeadlineClusterDraft[] = [];

    for (const article of articles) {
      const signature = this.createHeadlineSignature(article.title);
      const cluster = clusters.find((candidate) =>
        candidate.signatures.some((candidateSignature) => this.isSameHeadlineCluster(signature, candidateSignature)),
      );

      if (cluster) {
        cluster.articles.push(article);
        cluster.signatures.push(signature);
        continue;
      }

      clusters.push({
        clusterId: `cluster-${clusters.length + 1}`,
        representativeTitle: article.title,
        articles: [article],
        sortIndex: clusters.length,
        signatures: [signature],
      });
    }

    return clusters
      .sort((a, b) => {
        const publisherDiff = new Set(b.articles.map((article) => article.publisherKey)).size
          - new Set(a.articles.map((article) => article.publisherKey)).size;

        if (publisherDiff !== 0) {
          return publisherDiff;
        }

        return b.articles.length - a.articles.length || a.sortIndex - b.sortIndex;
      })
      .map(({ sortIndex, signatures, ...cluster }) => cluster);
  }

  private createHeadlineSignature(title: string): HeadlineTitleSignature {
    const normalized = title
      .replace(/<[^>]*>/g, " ")
      .replace(/&(?:quot|amp|lt|gt|nbsp|#39);/gi, " ")
      .toLowerCase()
      .replace(/[\[\(（【［][^\]\)）】］]{0,30}[\]\)）】］]/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    const compact = normalized.replace(/\s+/g, "");

    return {
      tokens: new Set(normalized.split(" ").filter((token) => token.length >= 2)),
      bigrams: this.toBigrams(compact),
    };
  }

  private isSameHeadlineCluster(a: HeadlineTitleSignature, b: HeadlineTitleSignature): boolean {
    return this.jaccard(a.tokens, b.tokens) >= HEADLINE_CLUSTER_SIMILARITY_THRESHOLD
      || this.dice(a.bigrams, b.bigrams) >= HEADLINE_CLUSTER_SIMILARITY_THRESHOLD;
  }

  private toBigrams(value: string): Set<string> {
    const bigrams = new Set<string>();

    for (let i = 0; i < value.length - 1; i += 1) {
      bigrams.add(value.slice(i, i + 2));
    }

    return bigrams;
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) {
      return 0;
    }

    let intersection = 0;
    for (const value of a) {
      if (b.has(value)) {
        intersection += 1;
      }
    }

    return intersection / (a.size + b.size - intersection);
  }

  private dice(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) {
      return 0;
    }

    let intersection = 0;
    for (const value of a) {
      if (b.has(value)) {
        intersection += 1;
      }
    }

    return (2 * intersection) / (a.size + b.size);
  }

  private async persistAnalysis(
    dateKey: string,
    category: HeadlineCategory,
    payload: HeadlineAnalysisPayload,
    articles: Array<{ id: string; publisherKey: string; publisherName: string; title: string; url: string }>,
  ): Promise<void> {
    const articleMap = new Map(articles.map((article) => [article.id, article]));

    await this.db.$transaction(async (tx: any) => {
      const analysis = await tx.headlineAnalysis.upsert({
        where: { dateKey_category: { dateKey, category } },
        create: {
          dateKey,
          category,
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

  private normalizeAnalysisPayload(
    payload: HeadlineAnalysisPayload,
    articles: Array<{ id: string; publisherKey: string; publisherName: string; title: string; url: string }>,
  ): HeadlineAnalysisPayload {
    const articleMap = new Map(articles.map((article) => [article.id, article]));
    const assignedArticleIds = new Set<string>();
    const clusters = payload.clusters
      .map((cluster, index) => ({
        ...cluster,
        sortIndex: index,
        items: cluster.items.filter((item) => {
          if (!articleMap.has(item.articleId) || assignedArticleIds.has(item.articleId)) {
            return false;
          }

          assignedArticleIds.add(item.articleId);
          return true;
        }),
      }))
      .filter((cluster) => cluster.items.length > 0);

    for (const article of articles) {
      if (assignedArticleIds.has(article.id)) {
        continue;
      }

      clusters.push({
        sortIndex: clusters.length,
        eventName: article.title,
        eventSummary: "",
        commonFacts: [],
        uncertainty: null,
        items: [{
          articleId: article.id,
          expressionSummary: "",
          emphasis: null,
          framing: null,
        }],
      });
    }

    return {
      summary: payload.summary,
      clusters: clusters
        .sort((a, b) => {
          const publisherDiff = new Set(b.items.map((item) => articleMap.get(item.articleId)?.publisherKey ?? "")).size
            - new Set(a.items.map((item) => articleMap.get(item.articleId)?.publisherKey ?? "")).size;

          if (publisherDiff !== 0) {
            return publisherDiff;
          }

          return b.items.length - a.items.length || a.sortIndex - b.sortIndex;
        })
        .map(({ sortIndex, ...cluster }) => cluster),
    };
  }

  private async upsertFailedAnalysis(dateKey: string, category: HeadlineCategory, errorMessage: string): Promise<void> {
    await this.db.headlineAnalysis.upsert({
      where: { dateKey_category: { dateKey, category } },
      create: {
        dateKey,
        category,
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
