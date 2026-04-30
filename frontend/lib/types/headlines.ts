export type HeadlineCategory = "politics" | "economy";

export interface HeadlineArticle {
  id: string;
  publisherKey: string;
  publisherName: string;
  category: HeadlineCategory;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
}

export interface HeadlinePublisherGroup {
  publisherKey: string;
  publisherName: string;
  category: HeadlineCategory;
  feedUrl: string;
  articles: HeadlineArticle[];
}

export interface HeadlineScrapeRun {
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  savedCount: number;
  errorMessage: string | null;
}

export interface HeadlinesTodayResponse {
  dateKey: string;
  totalArticleCount: number;
  lastScrapeRun: HeadlineScrapeRun | null;
  publishers: HeadlinePublisherGroup[];
}

export interface HeadlineClusterItem {
  articleId: string | null;
  publisherKey: string;
  publisherName: string;
  articleTitle: string;
  articleUrl: string;
  expressionSummary: string;
  emphasis: string | null;
  framing: string | null;
}

export interface HeadlineEventCluster {
  id: string;
  eventName: string;
  eventSummary: string;
  commonFacts: string[];
  uncertainty: string | null;
  items: HeadlineClusterItem[];
}

export interface HeadlinesAnalysisResponse {
  dateKey: string;
  status: "pending" | "ready" | "failed";
  summary: string | null;
  errorMessage: string | null;
  clusters: HeadlineEventCluster[];
}
