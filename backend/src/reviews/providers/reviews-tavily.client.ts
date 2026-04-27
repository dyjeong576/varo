import { Injectable } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import {
  ExtractedSource,
  SearchCandidate,
  SearchSourcesInput,
} from "../reviews.types";
import {
  buildCanonicalUrl,
  buildNormalizedHash,
  classifySourceType,
  inferCountryCodeFromUrl,
  matchDomainRegistryEntry,
} from "../reviews.utils";
import { postJson } from "./reviews-provider-http";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
const TAVILY_RESULTS_PER_QUERY = 5;
const MAX_EXTRACTION_CONTENT_LENGTH = 20000;
const MAX_SNIPPET_LENGTH = 320;

interface TavilySearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
    publishedAt?: string;
  }>;
}

interface TavilyExtractResponse {
  results?: Array<{
    url?: string;
    raw_content?: string;
    content?: string;
  }>;
  failed_results?: Array<{
    url?: string;
    error?: string;
  }>;
  request_id?: string;
}

@Injectable()
export class ReviewsTavilyClient {
  async searchSources(params: {
    apiKey: string;
    timeoutMs: number;
    input: SearchSourcesInput;
    bucket: SearchCandidate["retrievalBucket"];
    includeDomains?: string[];
  }): Promise<SearchCandidate[]> {
    const queryResults = await Promise.all(
      params.input.queries.map((query) =>
        this.searchSingleQuery({
          apiKey: params.apiKey,
          timeoutMs: params.timeoutMs,
          query,
          bucket: params.bucket,
          includeDomains: params.includeDomains,
          registry: params.input.domainRegistry,
        }),
      ),
    );

    return queryResults.flat();
  }

  async extractContent(params: {
    apiKey: string;
    timeoutMs: number;
    candidates: SearchCandidate[];
  }): Promise<ExtractedSource[]> {
    const response = await this.postTavilyExtract(params);

    return (response.results ?? [])
      .map((item) => {
        const rawUrl = typeof item.url === "string" ? item.url : null;
        const rawContent =
          typeof item.raw_content === "string"
            ? item.raw_content
            : typeof item.content === "string"
              ? item.content
              : null;

        if (!rawUrl || !rawContent) {
          return null;
        }

        const canonicalUrl = buildCanonicalUrl(rawUrl);
        const contentText = this.normalizeExtractedContent(rawContent);

        if (!contentText) {
          return null;
        }

        return {
          canonicalUrl,
          contentText,
          snippetText: this.buildSnippetText(contentText),
        };
      })
      .filter((item): item is ExtractedSource => item !== null);
  }

  private async postTavilyExtract(params: {
    apiKey: string;
    timeoutMs: number;
    candidates: SearchCandidate[];
  }): Promise<TavilyExtractResponse> {
    try {
      return await postJson<TavilyExtractResponse>(
        TAVILY_EXTRACT_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            urls: params.candidates.map((candidate) => candidate.originalUrl),
            include_images: false,
            extract_depth: "advanced",
            format: "markdown",
          }),
        },
        params.timeoutMs,
        APP_ERROR_CODES.EXTRACTION_FAILED,
        "Tavily 추출 요청에 실패했습니다.",
      );
    } catch (error) {
      if (error instanceof AppException) {
        throw new AppException(error.code, error.message, error.getStatus(), {
          ...(error.details ?? {}),
          urlCount: params.candidates.length,
        });
      }

      throw error;
    }
  }

  private async searchSingleQuery(input: {
    apiKey: string;
    timeoutMs: number;
    query: SearchSourcesInput["queries"][number];
    bucket: SearchCandidate["retrievalBucket"];
    includeDomains?: string[];
    registry: SearchSourcesInput["domainRegistry"];
  }): Promise<SearchCandidate[]> {
    const response = await postJson<TavilySearchResponse>(
      TAVILY_SEARCH_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: input.query.text,
          topic: "news",
          search_depth: "advanced",
          include_answer: false,
          include_raw_content: false,
          max_results: TAVILY_RESULTS_PER_QUERY,
          time_range: "year",
          exact_match: true,
          include_domains: input.includeDomains ?? [],
        }),
      },
      input.timeoutMs,
      APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
      "Tavily 검색 요청에 실패했습니다.",
    );

    return (response.results ?? [])
      .map((result, index): SearchCandidate | null => {
        const originalUrl =
          typeof result.url === "string" ? result.url.trim() : "";
        const rawTitle =
          typeof result.title === "string" ? result.title.trim() : "";

        if (!originalUrl || !rawTitle) {
          return null;
        }

        const canonicalUrl = buildCanonicalUrl(originalUrl);
        const rawSnippet =
          typeof result.content === "string"
            ? this.normalizeSnippet(result.content)
            : null;
        const registryMatch = matchDomainRegistryEntry(canonicalUrl, input.registry);

        return {
          id: `${input.query.id}-${input.bucket}-c${index + 1}`,
          searchRoute: "global_news",
          sourceProvider: "tavily-search",
          sourceType: classifySourceType(canonicalUrl, rawTitle),
          publisherName: this.inferPublisherName(canonicalUrl),
          publishedAt: this.readPublishedAt(result),
          canonicalUrl,
          originalUrl,
          rawTitle,
          rawSnippet,
          normalizedHash: buildNormalizedHash(canonicalUrl),
          originQueryIds: [input.query.id],
          originQueryPurposes: input.query.purpose ? [input.query.purpose] : [],
          sourceCountryCode:
            registryMatch?.countryCode === "GLOBAL"
              ? null
              : (registryMatch?.countryCode ??
                inferCountryCodeFromUrl(canonicalUrl)),
          retrievalBucket: input.bucket,
          domainRegistryId: registryMatch?.id ?? null,
        };
      })
      .filter((candidate): candidate is SearchCandidate => candidate !== null);
  }

  private inferPublisherName(url: string): string | null {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return hostname || null;
    } catch {
      return null;
    }
  }

  private readPublishedAt(result: {
    published_date?: string;
    publishedAt?: string;
  }): string | null {
    const publishedAt = result.published_date ?? result.publishedAt;

    if (!publishedAt) {
      return null;
    }

    const normalizedDate = new Date(publishedAt);

    if (Number.isNaN(normalizedDate.getTime())) {
      return null;
    }

    return normalizedDate.toISOString();
  }

  private normalizeSnippet(text: string): string | null {
    const normalized = text.replace(/\s+/g, " ").trim();

    if (!normalized) {
      return null;
    }

    return normalized.slice(0, MAX_SNIPPET_LENGTH);
  }

  private normalizeExtractedContent(content: string): string {
    return content
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_EXTRACTION_CONTENT_LENGTH);
  }

  private buildSnippetText(content: string): string {
    return content.slice(0, MAX_SNIPPET_LENGTH);
  }
}
