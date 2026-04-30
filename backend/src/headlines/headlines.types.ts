export type HeadlineAnalysisStatus = "pending" | "ready" | "failed";
export type HeadlineCategory = "politics" | "economy";
export type HeadlineScrapeStatus = "running" | "completed" | "failed";
export type HeadlineScrapeTrigger = "cron" | "manual";

export interface ParsedHeadlineItem {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
  rawItem: Record<string, unknown>;
}

export interface HeadlineAnalysisArticleInput {
  id: string;
  publisherKey: string;
  publisherName: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
}

export interface HeadlineAnalysisClusterItemPayload {
  articleId: string;
  expressionSummary: string;
  emphasis: string | null;
  framing: string | null;
}

export interface HeadlineAnalysisClusterPayload {
  eventName: string;
  eventSummary: string;
  commonFacts: string[];
  uncertainty: string | null;
  items: HeadlineAnalysisClusterItemPayload[];
}

export interface HeadlineAnalysisPayload {
  summary: string;
  clusters: HeadlineAnalysisClusterPayload[];
}
