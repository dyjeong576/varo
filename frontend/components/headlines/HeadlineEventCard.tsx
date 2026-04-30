"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { HeadlineEventCluster, HeadlineClusterItem } from "@/lib/types/headlines";

const CIRCLE_NUMBERS = ["①", "②", "③", "④"];

const PUBLISHER_ORDER = [
  { baseKey: "chosun", name: "조선일보", lean: "보수", leanClass: "bg-rose-50 text-rose-600" },
  { baseKey: "donga", name: "동아일보", lean: "보수", leanClass: "bg-rose-50 text-rose-600" },
  { baseKey: "yonhap", name: "연합뉴스", lean: "중도", leanClass: "bg-stone-100 text-stone-600" },
  { baseKey: "newsis", name: "뉴시스", lean: "중도", leanClass: "bg-stone-100 text-stone-600" },
  { baseKey: "hani", name: "한겨레", lean: "진보", leanClass: "bg-blue-50 text-blue-600" },
  { baseKey: "khan", name: "경향신문", lean: "진보", leanClass: "bg-blue-50 text-blue-600" },
] as const;

function getBaseKey(publisherKey: string): string {
  return publisherKey.replace(/-politics|-economy$/, "");
}

function CoverageBadge({ covered, total }: { covered: number; total: number }) {
  const ratio = covered / total;
  const colorClass =
    ratio === 1
      ? "bg-primary/10 text-primary"
      : ratio >= 0.5
        ? "bg-amber-50 text-amber-700"
        : "bg-gray-100 text-on-surface-variant";

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
      {covered}/{total} 보도
    </span>
  );
}

function PublisherCell({
  publisher,
  item,
}: {
  publisher: (typeof PUBLISHER_ORDER)[number];
  item: HeadlineClusterItem | undefined;
}) {
  if (!item) {
    return (
      <div className="flex flex-col rounded-xl border border-dashed border-gray-200 p-3">
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${publisher.leanClass}`}>
            {publisher.lean}
          </span>
          <span className="text-xs font-bold text-on-surface-variant">{publisher.name}</span>
        </div>
        <p className="mt-3 text-center text-xs text-on-surface-variant/50">미보도</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-gray-100 bg-surface-container-low/40 p-3">
      <div className="flex items-center gap-1.5">
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${publisher.leanClass}`}>
          {publisher.lean}
        </span>
        <span className="text-xs font-bold text-foreground">{publisher.name}</span>
      </div>
      <a href={item.articleUrl} target="_blank" rel="noreferrer" className="group mt-2 flex items-start gap-1">
        <p className="line-clamp-3 text-xs font-semibold leading-5 text-foreground group-hover:text-primary">
          {item.articleTitle}
        </p>
        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-on-surface-variant" />
      </a>
      {item.expressionSummary && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-on-surface-variant">{item.expressionSummary}</p>
      )}
    </div>
  );
}

interface HeadlineEventCardProps {
  cluster: HeadlineEventCluster;
  defaultOpen?: boolean;
}

export function HeadlineEventCard({ cluster, defaultOpen = false }: HeadlineEventCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const itemsByBaseKey = new Map<string, HeadlineClusterItem>(
    cluster.items.map((item) => [getBaseKey(item.publisherKey), item]),
  );
  const coveredPublisherCount = PUBLISHER_ORDER.filter((pub) => itemsByBaseKey.has(pub.baseKey)).length;

  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-foreground">{cluster.eventName}</h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-on-surface-variant">{cluster.eventSummary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <CoverageBadge covered={coveredPublisherCount} total={PUBLISHER_ORDER.length} />
          <ChevronDown
            className={`h-4 w-4 text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {PUBLISHER_ORDER.map((pub) => (
              <PublisherCell key={pub.baseKey} publisher={pub} item={itemsByBaseKey.get(pub.baseKey)} />
            ))}
          </div>

          {cluster.commonFacts.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                공통 팩트
              </p>
              <ul className="space-y-1.5">
                {cluster.commonFacts.map((fact, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="shrink-0 font-semibold text-primary">{CIRCLE_NUMBERS[i] ?? "•"}</span>
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cluster.uncertainty && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">※ {cluster.uncertainty}</p>
          )}
        </div>
      )}
    </div>
  );
}
