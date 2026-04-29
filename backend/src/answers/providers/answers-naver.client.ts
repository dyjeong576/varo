import { HttpStatus, Injectable } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { QueryPurpose, SearchCandidate } from "../answers.types";
import {
  buildCanonicalUrl,
  buildNormalizedHash,
} from "../answers.utils";
import { NaverNewsSearchSort } from "../dto/naver-news-search-test.dto";

const NAVER_NEWS_SEARCH_URL = "https://openapi.naver.com/v1/search/news.json";
const MAX_SNIPPET_LENGTH = 320;

interface NaverNewsSearchResponse {
  items?: Array<{
    title?: string;
    originallink?: string;
    link?: string;
    description?: string;
    pubDate?: string;
  }>;
}

@Injectable()
export class AnswersNaverClient {
  async searchNews(params: {
    clientId: string;
    clientSecret: string;
    timeoutMs: number;
    query: string;
    queryId?: string;
    queryPurpose?: QueryPurpose;
    display?: number;
    start?: number;
    sort?: NaverNewsSearchSort;
  }): Promise<SearchCandidate[]> {
    const display = params.display ?? 5;
    const start = params.start ?? 1;
    const sort = params.sort ?? "sim";
    const url = new URL(NAVER_NEWS_SEARCH_URL);

    url.searchParams.set("query", params.query);
    url.searchParams.set("display", String(display));
    url.searchParams.set("start", String(start));
    url.searchParams.set("sort", sort);

    const response = await this.getJson<NaverNewsSearchResponse>(
      url.toString(),
      {
        headers: {
          "X-Naver-Client-Id": params.clientId,
          "X-Naver-Client-Secret": params.clientSecret,
        },
      },
      params.timeoutMs,
    );

    return (response.items ?? [])
      .map((item, index) =>
        this.toCandidate(
          item,
          start + index,
          params.queryId ?? "q1",
          params.queryPurpose,
        ),
      )
      .filter((candidate): candidate is SearchCandidate => candidate !== null);
  }

  private async getJson<T>(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        method: "GET",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AppException(
        APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
        "Naver 뉴스 검색 요청에 실패했습니다.",
        HttpStatus.BAD_GATEWAY,
        {
          cause: error instanceof Error ? error.message : "unknown",
        },
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      throw new AppException(
        APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
        "Naver 뉴스 검색 요청에 실패했습니다.",
        HttpStatus.BAD_GATEWAY,
        {
          status: response.status,
          body: errorText.slice(0, 1000),
        },
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new AppException(
        APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
        "Naver 뉴스 검색 응답 JSON 파싱에 실패했습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private toCandidate(
    item: NonNullable<NaverNewsSearchResponse["items"]>[number],
    rank: number,
    queryId: string,
    queryPurpose?: QueryPurpose,
  ): SearchCandidate | null {
    const rawTitle = this.cleanNaverText(item.title ?? "");
    const rawSnippet = this.cleanNaverText(item.description ?? "");
    const canonicalSourceUrl = this.pickUrl(item.originallink, item.link);
    const originalSourceUrl = this.pickUrl(item.link, item.originallink);

    if (!rawTitle || !canonicalSourceUrl || !originalSourceUrl) {
      return null;
    }

    const canonicalUrl = buildCanonicalUrl(canonicalSourceUrl);
    const originalUrl = originalSourceUrl.trim();

    return {
      id: `naver-${queryId}-c${rank}`,
      searchRoute: "news",
      sourceProvider: "naver-search",
      sourceType: "news",
      publisherName: this.inferPublisherName(canonicalUrl),
      publishedAt: this.readPublishedAt(item.pubDate),
      canonicalUrl,
      originalUrl,
      rawTitle,
      rawSnippet: rawSnippet ? rawSnippet.slice(0, MAX_SNIPPET_LENGTH) : null,
      normalizedHash: buildNormalizedHash(canonicalUrl),
      originQueryIds: [queryId],
      originQueryPurposes: queryPurpose ? [queryPurpose] : [],
      retrievalBucket: "familiar",
      domainRegistryId: null,
    };
  }

  private pickUrl(primary?: string, fallback?: string): string | null {
    const primaryUrl = typeof primary === "string" ? primary.trim() : "";
    const fallbackUrl = typeof fallback === "string" ? fallback.trim() : "";

    return primaryUrl || fallbackUrl || null;
  }

  private inferPublisherName(url: string): string | null {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return hostname || null;
    } catch {
      return null;
    }
  }

  private readPublishedAt(value?: string): string | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  private cleanNaverText(value: string): string {
    return this.decodeBasicHtmlEntities(value)
      .replace(/<\/?b>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private decodeBasicHtmlEntities(value: string): string {
    return value
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
}
