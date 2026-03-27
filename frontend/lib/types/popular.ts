export type TrendType = 'up' | 'down' | 'steady';

export interface PopularTopic {
  id: string;
  rank: number;
  title: string;
  requestCount: number;
  trend: TrendType;
  trendValue?: number;
  updatedAt: string;
  isHot?: boolean;
}
