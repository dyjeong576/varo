import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeClaimText } from "../reviews/reviews.utils";
import { PopularTopicResponseDto } from "./dto/popular-topic-response.dto";

type TrendType = "up" | "down" | "steady";

const MIN_POPULARITY_SCORE = 10;

type ReviewJobRecord = {
  id: string;
  createdAt: Date;
  queryRefinement: unknown;
  handoffPayload: unknown;
  claim: {
    normalizedText: string;
  };
};

type UserHistoryRecord = {
  createdAt: Date;
  reviewJob: ReviewJobRecord;
};

type TopicAggregate = {
  topicKey: string;
  topicText: string;
  currentSubmittedCount: number;
  previousSubmittedCount: number;
  currentReopenCount: number;
  previousReopenCount: number;
  representativeReviewId: string | null;
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

    const [reviewJobs, reopenEvents] = await Promise.all([
      this.loadSubmittedReviewJobs(previousWindowStart),
      this.loadReopenEvents(previousWindowStart),
    ]);

    const topicMap = new Map<string, TopicAggregate>();

    for (const reviewJob of reviewJobs) {
      this.registerSubmittedEvent(topicMap, reviewJob, currentWindowStart);
    }

    for (const reopenEvent of reopenEvents) {
      this.registerReopenEvent(topicMap, reopenEvent, currentWindowStart);
    }

    const topics = [...topicMap.values()]
      .filter(
        (aggregate) =>
          aggregate.currentSubmittedCount + aggregate.currentReopenCount >= MIN_POPULARITY_SCORE &&
          aggregate.representativeReviewId &&
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
          reviewCount: aggregate.currentSubmittedCount,
          reopenCount: aggregate.currentReopenCount,
          trend,
          trendValue,
          representativeReviewId: aggregate.representativeReviewId!,
          updatedAt: aggregate.updatedAt!,
        };
      })
      .sort((left, right) => {
        if (right.popularityScore !== left.popularityScore) {
          return right.popularityScore - left.popularityScore;
        }

        if (right.reviewCount !== left.reviewCount) {
          return right.reviewCount - left.reviewCount;
        }

        return right.updatedAt.getTime() - left.updatedAt.getTime();
      })
      .slice(0, 20);

    return topics.map((topic, index) => ({
      topicKey: topic.topicKey,
      topicText: topic.topicText,
      rank: index + 1,
      popularityScore: topic.popularityScore,
      reviewCount: topic.reviewCount,
      reopenCount: topic.reopenCount,
      trend: topic.trend,
      trendValue: topic.trendValue,
      representativeReviewId: topic.representativeReviewId,
      updatedAt: topic.updatedAt.toISOString(),
    }));
  }

  private async loadSubmittedReviewJobs(
    previousWindowStart: Date,
  ): Promise<ReviewJobRecord[]> {
    return (await this.db.reviewJob.findMany({
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
        claim: {
          select: {
            normalizedText: true,
          },
        },
      },
    })) as ReviewJobRecord[];
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
          reviewJob: {
            select: {
              id: true,
              createdAt: true,
              queryRefinement: true,
              handoffPayload: true,
              claim: {
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
    reviewJob: ReviewJobRecord,
    currentWindowStart: Date,
  ): void {
    if (!this.hasHandoffPayload(reviewJob.handoffPayload)) {
      return;
    }

    const { topicKey, topicText } = this.resolveTopic(reviewJob);
    const aggregate = this.getOrCreateAggregate(topicMap, topicKey, topicText);

    if (reviewJob.createdAt >= currentWindowStart) {
      aggregate.currentSubmittedCount += 1;
      this.maybeUpdateRepresentative(aggregate, topicText, reviewJob.id, reviewJob.createdAt);
      return;
    }

    aggregate.previousSubmittedCount += 1;
  }

  private registerReopenEvent(
    topicMap: Map<string, TopicAggregate>,
    historyEntry: UserHistoryRecord,
    currentWindowStart: Date,
  ): void {
    if (!this.hasHandoffPayload(historyEntry.reviewJob.handoffPayload)) {
      return;
    }

    const { topicKey, topicText } = this.resolveTopic(historyEntry.reviewJob);
    const aggregate = this.getOrCreateAggregate(topicMap, topicKey, topicText);

    if (historyEntry.createdAt >= currentWindowStart) {
      aggregate.currentReopenCount += 1;
      this.maybeUpdateRepresentative(
        aggregate,
        topicText,
        historyEntry.reviewJob.id,
        historyEntry.createdAt,
      );
      return;
    }

    aggregate.previousReopenCount += 1;
  }

  private resolveTopic(reviewJob: ReviewJobRecord): {
    topicKey: string;
    topicText: string;
  } {
    const fallbackClaim = normalizeClaimText(reviewJob.claim.normalizedText);
    const coreClaim = this.extractCoreClaim(reviewJob.queryRefinement);
    const topicKey = normalizeClaimText(coreClaim ?? fallbackClaim);
    const topicText = coreClaim ?? fallbackClaim;

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
      representativeReviewId: null,
      updatedAt: null,
    };

    topicMap.set(topicKey, created);
    return created;
  }

  private maybeUpdateRepresentative(
    aggregate: TopicAggregate,
    topicText: string,
    reviewId: string,
    eventDate: Date,
  ): void {
    if (!aggregate.updatedAt || eventDate > aggregate.updatedAt) {
      aggregate.updatedAt = eventDate;
      aggregate.representativeReviewId = reviewId;
      aggregate.topicText = topicText;
    }
  }

  private hasHandoffPayload(value: unknown): boolean {
    return this.isRecord(value) && Object.keys(value).length > 0;
  }

  private extractCoreClaim(value: unknown): string | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const coreClaim = value.coreClaim;

    if (typeof coreClaim !== "string") {
      return null;
    }

    const normalized = normalizeClaimText(coreClaim);
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
