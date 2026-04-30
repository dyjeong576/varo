"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import type { HeadlineCategory, HeadlinesAnalysisResponse, HeadlinesTodayResponse } from "@/lib/types/headlines";

const MIN_HEADLINE_DATE = "2026-04-30";

function getPublisherCategory(publisher: HeadlinesTodayResponse["publishers"][number]): HeadlineCategory {
  return publisher.category ?? (publisher.publisherKey.endsWith("-economy") ? "economy" : "politics");
}

function getKstDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function HeadlinesPageClient() {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<HeadlineCategory>("politics");
  const [selectedDate, setSelectedDate] = useState(getKstDateKey);
  const [dateInput, setDateInput] = useState(getKstDateKey);
  const [today, setToday] = useState<HeadlinesTodayResponse | null>(null);
  const [analysis, setAnalysis] = useState<HeadlinesAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHeadlines() {
      try {
        setIsLoading(true);
        const [todayResponse, analysisResponse] = await Promise.all([
          api.headlines.getToday({ date: selectedDate, category: activeCategory }),
          api.headlines.getAnalysis({ date: selectedDate, category: activeCategory }),
        ]);

        if (!isMounted) {
          return;
        }

        setToday(todayResponse);
        setAnalysis(analysisResponse);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          router.replace("/login");
          return;
        }

        setErrorMessage("오늘의 헤드라인을 불러오지 못했습니다.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadHeadlines();

    return () => {
      isMounted = false;
    };
  }, [activeCategory, router, selectedDate]);

  const publisherCount = useMemo(
    () => today?.publishers.filter((publisher) => getPublisherCategory(publisher) === activeCategory && publisher.articles.length > 0).length ?? 0,
    [activeCategory, today],
  );
  const articleCount = useMemo(
    () => today?.publishers
      .filter((publisher) => getPublisherCategory(publisher) === activeCategory)
      .reduce((count, publisher) => count + publisher.articles.length, 0) ?? 0,
    [activeCategory, today],
  );
  const clusterCount = analysis?.clusters.length ?? 0;

  function openDatePicker() {
    const input = dateInputRef.current;

    if (!input) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  }

  function handleDateChange(value: string) {
    const nextDate = value < MIN_HEADLINE_DATE ? MIN_HEADLINE_DATE : value;

    setDateInput(nextDate);
    setSelectedDate(nextDate);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="rounded-2xl bg-white p-5 shadow-sm animate-pulse">
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

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-semibold text-primary">{today.dateKey}</p>
        <h1 className="text-3xl font-bold tracking-normal text-foreground">오늘의 헤드라인</h1>
        <p className="text-sm leading-6 text-on-surface-variant">
          같은 사건을 다룬 여러 매체의 헤드라인 표현을 수집된 제목과 요약 기준으로 비교합니다.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">기사 {articleCount}개</span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">매체 {publisherCount}곳</span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">사건 {clusterCount}개</span>
          <button
            type="button"
            onClick={openDatePicker}
            className="rounded-full bg-primary px-3 py-1 font-semibold text-white shadow-sm"
          >
            날짜 검색
          </button>
          <input
            ref={dateInputRef}
            type="date"
            min={MIN_HEADLINE_DATE}
            value={dateInput}
            onChange={(event) => handleDateChange(event.target.value)}
            className="sr-only"
            aria-label="헤드라인 조회 날짜"
          />
        </div>
      </section>

      <div className="grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveCategory("politics")}
          className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
            activeCategory === "politics" ? "bg-primary text-white" : "text-on-surface-variant"
          }`}
        >
          정치
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("economy")}
          className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
            activeCategory === "economy" ? "bg-primary text-white" : "text-on-surface-variant"
          }`}
        >
          경제
        </button>
      </div>

      <HeadlineAnalysis analysis={analysis} category={activeCategory} />
    </div>
  );
}

function HeadlineAnalysis({ analysis, category }: { analysis: HeadlinesAnalysisResponse | null; category: HeadlineCategory }) {
  if (!analysis || analysis.status === "pending") {
    return (
      <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-sm text-on-surface-variant">아직 {category === "politics" ? "정치" : "경제"} 사건별 분석이 준비되지 않았습니다.</p>
      </div>
    );
  }

  if (analysis.status === "failed") {
    return (
      <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-sm text-on-surface-variant">{analysis.errorMessage ?? "헤드라인 분석에 실패했습니다."}</p>
      </div>
    );
  }

  if (analysis.clusters.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-sm text-on-surface-variant">비교할 사건 묶음이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {analysis.clusters.map((cluster) => (
        <article key={cluster.id} className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">{cluster.eventName}</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{cluster.eventSummary}</p>
            </div>

            {cluster.commonFacts.length > 0 ? (
              <div className="rounded-xl bg-surface-container-low p-4">
                <p className="text-xs font-semibold text-on-surface-variant">공통으로 확인되는 내용</p>
                <ul className="mt-2 space-y-1">
                  {cluster.commonFacts.map((fact) => (
                    <li key={fact} className="text-sm leading-6 text-foreground">{fact}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="mt-5 divide-y divide-gray-100">
            {cluster.items.map((item) => (
              <a
                key={`${cluster.id}-${item.articleId ?? item.articleUrl}`}
                href={item.articleUrl}
                target="_blank"
                rel="noreferrer"
                className="block py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-primary">{item.publisherName}</p>
                    <h3 className="mt-1 text-sm font-semibold leading-6 text-foreground">{item.articleTitle}</h3>
                  </div>
                  <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-on-surface-variant" />
                </div>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{item.expressionSummary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                  {item.emphasis ? <span className="rounded-full bg-surface-container-low px-3 py-1">강조: {item.emphasis}</span> : null}
                  {item.framing ? <span className="rounded-full bg-surface-container-low px-3 py-1">표현: {item.framing}</span> : null}
                </div>
              </a>
            ))}
          </div>

          {cluster.uncertainty ? (
            <div className="mt-5 rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold text-on-surface-variant">남은 불확실성</p>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">{cluster.uncertainty}</p>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
