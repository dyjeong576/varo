import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeCheckText } from "../answers/answers.utils";
import { PopularTopicResponseDto } from "./dto/popular-topic-response.dto";

type TrendType = "up" | "down" | "steady";

const MIN_POPULARITY_SCORE = 10;

type AnswerJobRecord = {
  id: string;
  createdAt: Date;
  queryRefinement: unknown;
  handoffPayload: unknown;
  check: {
    normalizedText: string;
  };
};

type UserHistoryRecord = {
  createdAt: Date;
  answerJob: AnswerJobRecord;
};

type TopicAggregate = {
  topicKey: string;
  topicText: string;
  currentSubmittedCount: number;
  previousSubmittedCount: number;
  currentReopenCount: number;
  previousReopenCount: number;
  representativeAnswerId: string | null;
  updatedAt: Date | null;
};

@Injectable()
export class PopularService {
  private readonly logger = new Logger(PopularService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listTopics(): Promise<PopularTopicResponseDto[]> {
    const now = new Date();
    const currentWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const previousWindowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [answerJobs, reopenEvents] = await Promise.all([
      this.loadSubmittedAnswerJobs(previousWindowStart),
      this.loadReopenEvents(previousWindowStart),
    ]);

    const topicMap = new Map<string, TopicAggregate>();

    for (const answerJob of answerJobs) {
      this.registerSubmittedEvent(topicMap, answerJob, currentWindowStart);
    }

    for (const reopenEvent of reopenEvents) {
      this.registerReopenEvent(topicMap, reopenEvent, currentWindowStart);
    }

    const topics = [...topicMap.values()]
      .filter(
        (aggregate) =>
          aggregate.currentSubmittedCount + aggregate.currentReopenCount >= MIN_POPULARITY_SCORE &&
          aggregate.representativeAnswerId &&
          aggregate.updatedAt,
      )
      .map((aggregate) => {
        const popularityScore =
          aggregate.currentSubmittedCount + aggregate.currentReopenCount;
        const previousPopularityScore =
          aggregate.previousSubmittedCount + aggregate.previousReopenCount;
        const { trend, trendValue } = this.buildTrend(
          popularityScore,
          previousPopularityScore,
        );

        return {
          topicKey: aggregate.topicKey,
          topicText: aggregate.topicText,
          popularityScore,
          answerCount: aggregate.currentSubmittedCount,
          reopenCount: aggregate.currentReopenCount,
          trend,
          trendValue,
          representativeAnswerId: aggregate.representativeAnswerId!,
          updatedAt: aggregate.updatedAt!,
        };
      })
      .sort((left, right) => {
        if (right.popularityScore !== left.popularityScore) {
          return right.popularityScore - left.popularityScore;
        }

        if (right.answerCount !== left.answerCount) {
          return right.answerCount - left.answerCount;
        }

        return right.updatedAt.getTime() - left.updatedAt.getTime();
      })
      .slice(0, 20);

    return topics.map((topic, index) => ({
      topicKey: topic.topicKey,
      topicText: topic.topicText,
      rank: index + 1,
      popularityScore: topic.popularityScore,
      answerCount: topic.answerCount,
      reopenCount: topic.reopenCount,
      trend: topic.trend,
      trendValue: topic.trendValue,
      representativeAnswerId: topic.representativeAnswerId,
      updatedAt: topic.updatedAt.toISOString(),
    }));
  }

  private async loadSubmittedAnswerJobs(
    previousWindowStart: Date,
  ): Promise<AnswerJobRecord[]> {
    return (await this.db.answerJob.findMany({
      where: {
        createdAt: {
          gte: previousWindowStart,
        },
        handoffPayload: {
          not: Prisma.AnyNull,
        },
      },
      select: {
        id: true,
        createdAt: true,
        queryRefinement: true,
        handoffPayload: true,
        check: {
          select: {
            normalizedText: true,
          },
        },
      },
    })) as AnswerJobRecord[];
  }

  private async loadReopenEvents(
    previousWindowStart: Date,
  ): Promise<UserHistoryRecord[]> {
    const userHistory = this.db.userHistory as
      | {
          findMany: (args: unknown) => Promise<unknown>;
        }
      | undefined;

    if (!userHistory) {
      this.logger.warn(
        "userHistory model is not available in the current Prisma client. Falling back to submitted-only popular ranking.",
      );
      return [];
    }

    try {
      return (await userHistory.findMany({
        where: {
          createdAt: {
            gte: previousWindowStart,
          },
          entryType: "reopened",
        },
        select: {
          createdAt: true,
          answerJob: {
            select: {
              id: true,
              createdAt: true,
              queryRefinement: true,
              handoffPayload: true,
              check: {
                select: {
                  normalizedText: true,
                },
              },
            },
          },
        },
      })) as UserHistoryRecord[];
    } catch (error) {
      this.logger.warn(
        `Failed to load reopen events. Falling back to submitted-only popular ranking: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      return [];
    }
  }

  private registerSubmittedEvent(
    topicMap: Map<string, TopicAggregate>,
    answerJob: AnswerJobRecord,
    currentWindowStart: Date,
  ): void {
    if (!this.hasHandoffPayload(answerJob.handoffPayload)) {
      return;
    }

    const { topicKey, topicText } = this.resolveTopic(answerJob);
    const aggregate = this.getOrCreateAggregate(topicMap, topicKey, topicText);

    if (answerJob.createdAt >= currentWindowStart) {
      aggregate.currentSubmittedCount += 1;
      this.maybeUpdateRepresentative(aggregate, topicText, answerJob.id, answerJob.createdAt);
      return;
    }

    aggregate.previousSubmittedCount += 1;
  }

  private registerReopenEvent(
    topicMap: Map<string, TopicAggregate>,
    historyEntry: UserHistoryRecord,
    currentWindowStart: Date,
  ): void {
    if (!this.hasHandoffPayload(historyEntry.answerJob.handoffPayload)) {
      return;
    }

    const { topicKey, topicText } = this.resolveTopic(historyEntry.answerJob);
    const aggregate = this.getOrCreateAggregate(topicMap, topicKey, topicText);

    if (historyEntry.createdAt >= currentWindowStart) {
      aggregate.currentReopenCount += 1;
      this.maybeUpdateRepresentative(
        aggregate,
        topicText,
        historyEntry.answerJob.id,
        historyEntry.createdAt,
      );
      return;
    }

    aggregate.previousReopenCount += 1;
  }

  private resolveTopic(answerJob: AnswerJobRecord): {
    topicKey: string;
    topicText: string;
  } {
    const fallbackCheck = normalizeCheckText(answerJob.check.normalizedText);
    const coreCheck = this.extractCoreCheck(answerJob.queryRefinement);
    const topicKey = normalizeCheckText(coreCheck ?? fallbackCheck);
    const topicText = coreCheck ?? fallbackCheck;

    return { topicKey, topicText };
  }

  private getOrCreateAggregate(
    topicMap: Map<string, TopicAggregate>,
    topicKey: string,
    topicText: string,
  ): TopicAggregate {
    const existing = topicMap.get(topicKey);

    if (existing) {
      return existing;
    }

    const created: TopicAggregate = {
      topicKey,
      topicText,
      currentSubmittedCount: 0,
      previousSubmittedCount: 0,
      currentReopenCount: 0,
      previousReopenCount: 0,
      representativeAnswerId: null,
      updatedAt: null,
    };

    topicMap.set(topicKey, created);
    return created;
  }

  private maybeUpdateRepresentative(
    aggregate: TopicAggregate,
    topicText: string,
    answerId: string,
    eventDate: Date,
  ): void {
    if (!aggregate.updatedAt || eventDate > aggregate.updatedAt) {
      aggregate.updatedAt = eventDate;
      aggregate.representativeAnswerId = answerId;
      aggregate.topicText = topicText;
    }
  }

  private hasHandoffPayload(value: unknown): boolean {
    return this.isRecord(value) && Object.keys(value).length > 0;
  }

  private extractCoreCheck(value: unknown): string | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const coreCheck = value.coreCheck;

    if (typeof coreCheck !== "string") {
      return null;
    }

    const normalized = normalizeCheckText(coreCheck);
    return normalized ? normalized : null;
  }

  private buildTrend(
    currentCount: number,
    previousCount: number,
  ): { trend: TrendType; trendValue: number | null } {
    let trend: TrendType = "steady";

    if (currentCount > previousCount) {
      trend = "up";
    } else if (currentCount < previousCount) {
      trend = "down";
    }

    if (previousCount < 1) {
      return {
        trend,
        trendValue: null,
      };
    }

    return {
      trend,
      trendValue: Number((((currentCount - previousCount) / previousCount) * 100).toFixed(1)),
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
}
