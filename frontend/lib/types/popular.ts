export type TrendType = 'up' | 'down' | 'steady';

export interface PopularTopic {
  topicKey: string;
  topicText: string;
  rank: number;
  popularityScore: number;
  answerCount: number;
  reopenCount: number;
  trend: TrendType;
  trendValue: number | null;
  representativeAnswerId: string;
  updatedAt: string;
}
