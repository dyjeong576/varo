import type { HeadlinesAnalysisResponse, HeadlineCategory } from "@/lib/types/headlines";
import { HeadlineEventCard } from "./HeadlineEventCard";

interface HeadlineEventFeedProps {
  analysis: HeadlinesAnalysisResponse;
  category: HeadlineCategory;
}

export function HeadlineEventFeed({ analysis, category }: HeadlineEventFeedProps) {
  if (analysis.clusters.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-sm text-on-surface-variant">
          {category === "politics" ? "정치" : "경제"} 분석 결과가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {analysis.summary && (
        <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            오늘의 요약
          </p>
          <p className="text-sm leading-6 text-foreground">{analysis.summary}</p>
        </div>
      )}
      {analysis.clusters.map((cluster, index) => (
        <HeadlineEventCard key={cluster.id} cluster={cluster} defaultOpen={index === 0} />
      ))}
    </div>
  );
}
