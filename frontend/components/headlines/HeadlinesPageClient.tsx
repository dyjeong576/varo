"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import type {
  HeadlineCategory,
  HeadlinesTodayResponse,
  HeadlinesAnalysisResponse,
} from "@/lib/types/headlines";
import { HeadlineEventFeed } from "./HeadlineEventFeed";

const MIN_HEADLINE_DATE = "2026-04-30";

function getKstDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function clampHeadlineDate(value: string): string {
  const maxHeadlineDate = getKstDateKey();

  if (value < MIN_HEADLINE_DATE) {
    return MIN_HEADLINE_DATE;
  }

  if (value > maxHeadlineDate) {
    return maxHeadlineDate;
  }

  return value;
}

function getPublisherCategory(
  publisher: HeadlinesTodayResponse["publishers"][number],
): HeadlineCategory {
  return publisher.category ?? (publisher.publisherKey.endsWith("-economy") ? "economy" : "politics");
}

export function HeadlinesPageClient() {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const maxHeadlineDate = getKstDateKey();
  const [activeCategory, setActiveCategory] = useState<HeadlineCategory>("politics");
  const [selectedDate, setSelectedDate] = useState(getKstDateKey);
  const [dateInput, setDateInput] = useState(getKstDateKey);
  const [today, setToday] = useState<HeadlinesTodayResponse | null>(null);
  const [analysis, setAnalysis] = useState<HeadlinesAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        const [todayResponse, analysisResponse] = await Promise.all([
          api.headlines.getToday({ date: selectedDate, category: activeCategory }),
          api.headlines.getAnalysis({ date: selectedDate, category: activeCategory }),
        ]);

        if (!isMounted) return;

        setToday(todayResponse);
        setAnalysis(analysisResponse);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) return;

        if (error instanceof ApiClientError && error.status === 401) {
          router.replace("/login");
          return;
        }

        setErrorMessage("헤드라인을 불러오지 못했습니다.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [activeCategory, router, selectedDate]);

  const publisherCount = useMemo(
    () =>
      today?.publishers.filter(
        (p) => getPublisherCategory(p) === activeCategory && p.articles.length > 0,
      ).length ?? 0,
    [activeCategory, today],
  );

  const articleCount = useMemo(
    () =>
      today?.publishers
        .filter((p) => getPublisherCategory(p) === activeCategory)
        .reduce((sum, p) => sum + p.articles.length, 0) ?? 0,
    [activeCategory, today],
  );
  const clusterCount = analysis?.clusters.length ?? 0;

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  }

  function handleDateChange(value: string) {
    const nextDate = clampHeadlineDate(value);
    setDateInput(nextDate);
    setSelectedDate(nextDate);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="animate-pulse rounded-2xl bg-white p-5 shadow-sm">
            <div className="h-4 w-28 rounded-full bg-surface-container-low" />
            <div className="mt-4 h-6 w-3/4 rounded-full bg-surface-container-low" />
            <div className="mt-3 h-4 w-full rounded-full bg-surface-container-low" />
          </div>
        ))}
      </div>
    );
  }

  if (errorMessage || !today) {
    return (
      <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-sm text-on-surface-variant">{errorMessage}</p>
      </div>
    );
  }

  const visiblePublishers = today.publishers.filter(
    (p) => getPublisherCategory(p) === activeCategory && p.articles.length > 0,
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-semibold text-primary">{today.dateKey}</p>
        <h1 className="text-3xl font-bold tracking-normal text-foreground">오늘의 헤드라인</h1>
        <p className="text-sm leading-6 text-on-surface-variant">
          같은 사건을 다룬 여러 매체의 헤드라인 표현을 수집된 제목과 요약 기준으로 비교합니다.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary ring-1 ring-primary/10">
            <Clock className="h-3.5 w-3.5" />
            매일 새벽 1시 업데이트
          </span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">기사 {articleCount}개</span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">매체 {publisherCount}곳</span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">사건 {clusterCount}개</span>
          <button
            type="button"
            onClick={openDatePicker}
            className="cursor-pointer rounded-full bg-primary px-3 py-1 font-semibold text-white shadow-sm"
          >
            날짜 검색
          </button>
          <input
            ref={dateInputRef}
            type="date"
            min={MIN_HEADLINE_DATE}
            max={maxHeadlineDate}
            value={dateInput}
            onChange={(e) => handleDateChange(e.target.value)}
            className="sr-only"
            aria-label="헤드라인 조회 날짜"
          />
        </div>
      </section>

      <div className="grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveCategory("politics")}
          className={`h-10 cursor-pointer rounded-lg text-sm font-semibold transition-colors ${
            activeCategory === "politics" ? "bg-primary text-white" : "text-on-surface-variant"
          }`}
        >
          정치
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("economy")}
          className={`h-10 cursor-pointer rounded-lg text-sm font-semibold transition-colors ${
            activeCategory === "economy" ? "bg-primary text-white" : "text-on-surface-variant"
          }`}
        >
          경제
        </button>
      </div>

      {analysis?.status === "ready" && analysis.clusters.length > 0 ? (
        <HeadlineEventFeed analysis={analysis} category={activeCategory} />
      ) : analysis?.status === "pending" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-2xl bg-white px-5 py-4 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm text-on-surface-variant">분석을 준비 중입니다. 잠시 후 다시 확인해주세요.</p>
          </div>
          <HeadlinePublisherTable publishers={visiblePublishers} category={activeCategory} />
        </div>
      ) : (
        <HeadlinePublisherTable publishers={visiblePublishers} category={activeCategory} />
      )}
    </div>
  );
}

function HeadlinePublisherTable({
  publishers,
  category,
}: {
  publishers: HeadlinesTodayResponse["publishers"];
  category: HeadlineCategory;
}) {
  if (publishers.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-sm text-on-surface-variant">
          아직 저장된 {category === "politics" ? "정치" : "경제"} 헤드라인이 없습니다.
        </p>
      </div>
    );
  }

  const maxArticleCount = Math.max(...publishers.map((p) => p.articles.length));

  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
      <table className="min-w-[960px] w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            {publishers.map((publisher) => (
              <th key={publisher.publisherKey} scope="col" className="w-40 px-4 py-3 text-left align-top lg:w-1/6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">{publisher.publisherName}</p>
                    <p className="mt-1 text-[11px] font-medium text-on-surface-variant">
                      RSS 기사 {publisher.articles.length}개
                    </p>
                  </div>
                  <a
                    href={publisher.feedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer rounded-full p-1 text-on-surface-variant hover:bg-surface-container-low"
                    aria-label={`${publisher.publisherName} RSS 열기`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: maxArticleCount }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {publishers.map((publisher) => {
                const article = publisher.articles[rowIndex];
                return (
                  <td key={publisher.publisherKey} className="px-4 py-4 align-top">
                    {article ? (
                      <a href={article.url} target="_blank" rel="noreferrer" className="block cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-3 text-sm font-semibold leading-6 text-foreground">
                            {article.title}
                          </h3>
                          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
                        </div>
                        {article.summary ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-on-surface-variant">
                            {article.summary}
                          </p>
                        ) : null}
                      </a>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
