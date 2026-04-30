import type { HeadlinesAnalysisResponse, HeadlineCategory } from "@/lib/types/headlines";
import { HeadlineEventCard } from "./HeadlineEventCard";

interface HeadlineEventFeedProps {
  analysis: HeadlinesAnalysisResponse;
  category: HeadlineCategory;
}

function SummaryContent({ summary }: { summary: string }) {
  const lines = summary.split(/\r?\n/).map((line) => line.trim());
  const blocks: Array<{ type: "paragraph" | "list"; items: string[] }> = [];

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (line.startsWith("- ")) {
      const lastBlock = blocks[blocks.length - 1];
      const item = line.slice(2).trim();

      if (!item) {
        continue;
      }

      if (lastBlock?.type === "list") {
        lastBlock.items.push(item);
      } else {
        blocks.push({ type: "list", items: [item] });
      }
      continue;
    }

    blocks.push({ type: "paragraph", items: [line] });
  }

  return (
    <div className="space-y-3 text-sm leading-6 text-foreground">
      {blocks.map((block, index) =>
        block.type === "list" ? (
          <ul key={index} className="list-disc space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={`${index}-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{block.items[0]}</p>
        ),
      )}
    </div>
  );
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
          <SummaryContent summary={analysis.summary} />
        </div>
      )}
      {analysis.clusters.map((cluster, index) => (
        <HeadlineEventCard key={cluster.id} cluster={cluster} defaultOpen={index === 0} />
      ))}
    </div>
  );
}
