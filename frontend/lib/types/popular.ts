export type TrendType = 'up' | 'down' | 'steady';

export interface PopularTopic {
  topicKey: string;
  topicText: string;
  rank: number;
  popularityScore: number;
  reviewCount: number;
  reopenCount: number;
  trend: TrendType;
  trendValue: number | null;
  representativeReviewId: string;
  updatedAt: string;
}
