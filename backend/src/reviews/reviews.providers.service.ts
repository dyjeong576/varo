import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import {
  QueryArtifact,
  ReviewRelevanceTier,
  SearchCandidate,
  buildCanonicalUrl,
  buildMockCoreClaim,
  buildMockQueries,
  buildNormalizedHash,
  classifySourceType,
} from "./reviews.utils";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_TIMEOUT_MS = 30000;
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
const TAVILY_RESULTS_PER_QUERY = 5;
const MAX_EXTRACTION_CONTENT_LENGTH = 20000;
const MAX_SNIPPET_LENGTH = 320;

interface QueryRefinementResult {
  languageCode: string;
  coreClaim: string;
  generatedQueries: QueryArtifact[];
}

interface ExtractedSource {
  canonicalUrl: string;
  contentText: string;
  snippetText: string;
}

interface OpenAiQueryRefinementPayload {
  languageCode: string;
  coreClaim: string;
  generatedQueries: string[];
}

interface OpenAiRelevanceDecision {
  candidateId: string;
  relevanceTier: ReviewRelevanceTier;
  relevanceReason: string;
}

interface OpenAiRelevancePayload {
  decisions: OpenAiRelevanceDecision[];
}

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
}

@Injectable()
export class ReviewsProvidersService {
  constructor(private readonly configService: ConfigService) {}

  async refineQuery(rawClaim: string): Promise<QueryRefinementResult> {
    const apiKey = this.getRequiredOpenAiApiKey();
    const payload =
      await this.requestOpenAiStructuredOutput<OpenAiQueryRefinementPayload>(
        apiKey,
        {
          name: "review_query_refinement",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["languageCode", "coreClaim", "generatedQueries"],
            properties: {
              languageCode: { type: "string" },
              coreClaim: { type: "string" },
              generatedQueries: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3,
              },
            },
          },
        },
        [
          {
            role: "system",
            content:
              "사용자 발화에서 팩트체크가 필요한 핵심 주장을 추출하고 뉴스 검색에 최적화된 쿼리 3개를 JSON으로 반환하세요. 언어는 원문 언어를 유지하세요. 구어체는 제거하고 고유명사, 날짜, 수치, 기관명은 우선 포함하세요. 검색 엔진 친화적인 명사형 쿼리로 변환하세요.",
          },
          {
            role: "user",
            content: rawClaim,
          },
        ],
        "질의 정제 요청에 실패했습니다.",
      );

    const queries = payload.generatedQueries
      .map((query, index) => query.trim())
      .filter(Boolean);

    if (
      typeof payload.languageCode !== "string" ||
      typeof payload.coreClaim !== "string" ||
      !payload.languageCode.trim() ||
      queries.length !== 3
    ) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "질의 정제 결과가 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      languageCode: payload.languageCode.trim(),
      coreClaim: payload.coreClaim.trim(),
      generatedQueries: queries.map((query, index) => ({
        id: `q${index + 1}`,
        text: query,
        rank: index + 1,
      })),
    };
  }

  async searchSources(
    queries: QueryArtifact[],
    coreClaim: string,
  ): Promise<SearchCandidate[]> {
    const apiKey = this.getRequiredTavilyApiKey();
    const timeoutMs = this.getTavilySearchTimeoutMs();
    const queryResults = await Promise.all(
      queries.map((query) => this.searchSingleQuery(apiKey, query, timeoutMs)),
    );

    return queryResults.flat();
  }

  async applyRelevanceFiltering(
    coreClaim: string,
    candidates: SearchCandidate[],
  ): Promise<SearchCandidate[]> {
    const apiKey = this.getRequiredOpenAiApiKey();
    const payload =
      await this.requestOpenAiStructuredOutput<OpenAiRelevancePayload>(
        apiKey,
        {
          name: "review_source_relevance",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["decisions"],
            properties: {
              decisions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["candidateId", "relevanceTier", "relevanceReason"],
                  properties: {
                    candidateId: { type: "string" },
                    relevanceTier: {
                      type: "string",
                      enum: ["primary", "reference", "discard"],
                    },
                    relevanceReason: { type: "string" },
                  },
                },
              },
            },
          },
        },
        [
          {
            role: "system",
            content:
              "당신은 뉴스 검토용 relevance filter입니다. core claim, 기사 제목, snippet, 출처 유형을 보고 extraction 이전 단계에서 source를 분류하세요. primary는 직접 검증 근거, reference는 공식 입장문·정정 기사·배경 해설처럼 보조 가치가 있는 source, discard는 관련성이 부족한 source입니다.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                coreClaim,
                candidates: candidates.map((candidate) => ({
                  candidateId: candidate.id,
                  title: candidate.rawTitle,
                  snippet: candidate.rawSnippet,
                  publisherName: candidate.publisherName,
                  sourceType: candidate.sourceType,
                  canonicalUrl: candidate.canonicalUrl,
                })),
              },
              null,
              2,
            ),
          },
        ],
        "관련성 필터링 요청에 실패했습니다.",
      );

    if (!this.isValidRelevancePayload(payload, candidates)) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "관련성 필터링 결과가 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    const decisions = new Map(
      payload.decisions.map((decision) => [decision.candidateId, decision]),
    );

    return candidates.map((candidate) => {
      const decision = decisions.get(candidate.id);

      return {
        ...candidate,
        relevanceTier: decision?.relevanceTier ?? "discard",
        relevanceReason:
          decision?.relevanceReason ?? "관련성 판정 결과가 누락되었습니다.",
      };
    });
  }

  async extractContent(
    candidates: SearchCandidate[],
  ): Promise<ExtractedSource[]> {
    const apiKey = this.getRequiredTavilyApiKey();
    const timeoutMs = this.getTavilyExtractTimeoutMs();
    const response = await this.postJson<TavilyExtractResponse>(
      TAVILY_EXTRACT_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: candidates.map((candidate) => candidate.originalUrl),
          include_images: false,
          extract_depth: "advanced",
          format: "markdown",
        }),
      },
      timeoutMs,
      APP_ERROR_CODES.EXTRACTION_FAILED,
      "Tavily 추출 요청에 실패했습니다.",
    );

    const extracted = (response.results ?? [])
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

    if (candidates.length > 0 && extracted.length === 0) {
      throw new AppException(
        APP_ERROR_CODES.EXTRACTION_FAILED,
        "추출 가능한 본문을 확보하지 못했습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    return extracted;
  }

  private getRequiredOpenAiApiKey(): string {
    const apiKey = this.configService.get<string | null>("openAiApiKey", null);

    if (!apiKey) {
      throw new AppException(
        APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
        "real provider mode에서는 OPENAI_API_KEY가 필요합니다.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiKey;
  }

  private getRequiredTavilyApiKey(): string {
    const apiKey = this.configService.get<string | null>("tavilyApiKey", null);

    if (!apiKey) {
      throw new AppException(
        APP_ERROR_CODES.CONFIG_VALIDATION_ERROR,
        "real provider mode에서는 TAVILY_API_KEY가 필요합니다.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiKey;
  }

  private getTavilySearchTimeoutMs(): number {
    return this.configService.get<number>("tavilySearchTimeoutMs", 40000);
  }

  private getTavilyExtractTimeoutMs(): number {
    return this.configService.get<number>("tavilyExtractTimeoutMs", 80000);
  }

  private async requestOpenAiStructuredOutput<T>(
    apiKey: string,
    schema: { name: string; schema: Record<string, unknown> },
    input: Array<{ role: "system" | "user"; content: string }>,
    errorMessage: string,
  ): Promise<T> {
    const response = await this.postJson<unknown>(
      OPENAI_RESPONSES_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          input,
          text: {
            format: {
              type: "json_schema",
              name: schema.name,
              schema: schema.schema,
              strict: true,
            },
          },
        }),
      },
      OPENAI_TIMEOUT_MS,
      APP_ERROR_CODES.INTERNAL_ERROR,
      errorMessage,
    );

    return this.parseOpenAiStructuredOutput<T>(response);
  }

  private async searchSingleQuery(
    apiKey: string,
    query: QueryArtifact,
    timeoutMs: number,
  ): Promise<SearchCandidate[]> {
    const response = await this.postJson<TavilySearchResponse>(
      TAVILY_SEARCH_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query.text,
          topic: "news",
          search_depth: "advanced",
          include_answer: false,
          include_raw_content: false,
          max_results: TAVILY_RESULTS_PER_QUERY,
          time_range: "year",
        }),
      },
      timeoutMs,
      APP_ERROR_CODES.SOURCE_SEARCH_FAILED,
      "Tavily 검색 요청에 실패했습니다.",
    );

    return (response.results ?? [])
      .map((result, index) => {
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

        return {
          id: `${query.id}-c${index + 1}`,
          sourceType: classifySourceType(canonicalUrl, rawTitle),
          publisherName: this.inferPublisherName(canonicalUrl),
          publishedAt: this.readPublishedAt(result),
          canonicalUrl,
          originalUrl,
          rawTitle,
          rawSnippet,
          normalizedHash: buildNormalizedHash(canonicalUrl),
          originQueryIds: [query.id],
        };
      })
      .filter((candidate): candidate is SearchCandidate => candidate !== null);
  }

  private parseOpenAiStructuredOutput<T>(response: unknown): T {
    const refusal = this.extractRefusalText(response);

    if (refusal) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "OpenAI가 구조화된 출력을 반환하지 않았습니다.",
        HttpStatus.BAD_GATEWAY,
        { refusal },
      );
    }

    const outputText = this.extractOpenAiOutputText(response);

    try {
      return JSON.parse(outputText) as T;
    } catch {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "OpenAI 응답이 유효한 JSON이 아닙니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private extractOpenAiOutputText(response: unknown): string {
    if (!response || typeof response !== "object") {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "OpenAI 응답 형식을 해석할 수 없습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    const directText = (response as { output_text?: unknown }).output_text;

    if (typeof directText === "string" && directText.trim()) {
      return directText;
    }

    const output = (response as { output?: unknown }).output;

    if (!Array.isArray(output)) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "OpenAI 응답에 output 배열이 없습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    for (const item of output) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const content = (item as { content?: unknown }).content;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const part of content) {
        if (!part || typeof part !== "object") {
          continue;
        }

        const textValue = (part as { text?: unknown }).text;

        if (typeof textValue === "string" && textValue.trim()) {
          return textValue;
        }
      }
    }

    throw new AppException(
      APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      "OpenAI 응답에서 구조화된 텍스트를 찾지 못했습니다.",
      HttpStatus.BAD_GATEWAY,
    );
  }

  private extractRefusalText(response: unknown): string | null {
    if (!response || typeof response !== "object") {
      return null;
    }

    const output = (response as { output?: unknown }).output;

    if (!Array.isArray(output)) {
      return null;
    }

    for (const item of output) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const content = (item as { content?: unknown }).content;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const part of content) {
        if (!part || typeof part !== "object") {
          continue;
        }

        if ((part as { type?: unknown }).type !== "refusal") {
          continue;
        }

        const refusal =
          (part as { refusal?: unknown }).refusal ??
          (part as { text?: unknown }).text;

        if (typeof refusal === "string" && refusal.trim()) {
          return refusal;
        }
      }
    }

    return null;
  }

  private isValidRelevancePayload(
    payload: OpenAiRelevancePayload,
    candidates: SearchCandidate[],
  ): payload is OpenAiRelevancePayload {
    if (!payload || !Array.isArray(payload.decisions)) {
      return false;
    }

    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const seenIds = new Set<string>();

    for (const decision of payload.decisions) {
      if (
        !decision ||
        typeof decision.candidateId !== "string" ||
        typeof decision.relevanceReason !== "string" ||
        !["primary", "reference", "discard"].includes(decision.relevanceTier)
      ) {
        return false;
      }

      if (
        !candidateIds.has(decision.candidateId) ||
        seenIds.has(decision.candidateId)
      ) {
        return false;
      }

      seenIds.add(decision.candidateId);
    }

    return seenIds.size === candidateIds.size;
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

  private async postJson<T>(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    errorCode: (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES],
    errorMessage: string,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AppException(errorCode, errorMessage, HttpStatus.BAD_GATEWAY, {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      throw new AppException(errorCode, errorMessage, HttpStatus.BAD_GATEWAY, {
        status: response.status,
        body: errorText.slice(0, 1000),
      });
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new AppException(
        errorCode,
        `${errorMessage} 응답 JSON 파싱에 실패했습니다.`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private buildMockRefinement(rawClaim: string): QueryRefinementResult {
    const languageCode = /[가-힣]/.test(rawClaim) ? "ko" : "en";
    const coreClaim = buildMockCoreClaim(rawClaim);
    const generatedQueries = buildMockQueries(coreClaim, languageCode);

    if (generatedQueries.length !== 3) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "질의 정제 결과가 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      languageCode,
      coreClaim,
      generatedQueries,
    };
  }

  private buildMockSearchResults(
    queries: QueryArtifact[],
    coreClaim: string,
  ): SearchCandidate[] {
    const safeClaim = coreClaim || queries[0]?.text || "검토 대상 주장";
    const baseResults = [
      {
        publisherName: "연합뉴스",
        title: `${safeClaim} 관련 보도`,
        snippet: `${safeClaim}와 관련해 주요 사실관계와 배경을 설명하는 기사입니다.`,
        url: "https://news.example.com/articles/varo-core",
      },
      {
        publisherName: "정부부처 보도자료",
        title: `${safeClaim} 공식 입장`,
        snippet: `${safeClaim}와 관련된 공식 설명과 기준 문장을 포함합니다.`,
        url: "https://www.gov.example.kr/press/varo-official",
      },
      {
        publisherName: "해설 매체",
        title: `${safeClaim} 해설`,
        snippet: `${safeClaim}의 맥락을 설명하지만 직접 검증 근거는 제한적일 수 있습니다.`,
        url: "https://analysis.example.com/varo-explainer",
      },
      {
        publisherName: "무관한 블로그",
        title: `${safeClaim.split(" ")[0] ?? safeClaim} 투자 전략`,
        snippet:
          "동일 키워드를 포함하지만 검토 대상 주장과 직접 관련 없는 글입니다.",
        url: "https://blog.example.com/off-topic",
      },
    ];

    return queries.flatMap((query, index) =>
      baseResults.slice(0, index === 0 ? 4 : 3).map((result, resultIndex) => {
        const canonicalUrl =
          resultIndex === 0 && index > 0
            ? buildCanonicalUrl(
                "https://news.example.com/articles/varo-core?utm_source=dup",
              )
            : buildCanonicalUrl(result.url);

        return {
          id: `${query.id}-c${resultIndex + 1}`,
          sourceType: classifySourceType(canonicalUrl, result.title),
          publisherName: result.publisherName,
          publishedAt: new Date(
            Date.now() - (index + resultIndex + 1) * 60 * 60 * 1000,
          ).toISOString(),
          canonicalUrl,
          originalUrl: result.url,
          rawTitle: result.title,
          rawSnippet: result.snippet,
          normalizedHash: buildNormalizedHash(canonicalUrl),
          originQueryIds: [query.id],
        };
      }),
    );
  }

  private buildMockRelevance(
    coreClaim: string,
    candidates: SearchCandidate[],
  ): SearchCandidate[] {
    return candidates.map((candidate) => {
      const combined =
        `${candidate.rawTitle} ${candidate.rawSnippet ?? ""}`.toLowerCase();
      const coreTokens = coreClaim.toLowerCase().split(/\s+/).filter(Boolean);
      const matchedTokens = coreTokens.filter((token) =>
        combined.includes(token),
      ).length;

      let relevanceTier: ReviewRelevanceTier = "discard";
      let reason = "검토 대상 주장과 직접 관련된 근거 신호가 부족합니다.";

      if (candidate.sourceType === "official" || matchedTokens >= 2) {
        relevanceTier = "primary";
        reason =
          "핵심 claim과 직접 관련된 제목 또는 공식 출처 신호가 확인됩니다.";
      } else if (matchedTokens === 1 || candidate.sourceType === "analysis") {
        relevanceTier = "reference";
        reason = "직접성은 약하지만 보조 맥락으로 검토할 가치가 있습니다.";
      }

      return {
        ...candidate,
        relevanceTier,
        relevanceReason: reason,
      };
    });
  }

  private async buildMockExtraction(
    candidates: SearchCandidate[],
  ): Promise<ExtractedSource[]> {
    return candidates.map((candidate) => ({
      canonicalUrl: candidate.canonicalUrl,
      contentText:
        candidate.rawSnippet ??
        `${candidate.rawTitle}에 대한 추출 본문이 생성되지 않아 snippet을 본문 대체값으로 사용합니다.`,
      snippetText:
        candidate.rawSnippet ??
        `${candidate.rawTitle} 관련 핵심 문장을 추출했습니다.`,
    }));
  }
}
