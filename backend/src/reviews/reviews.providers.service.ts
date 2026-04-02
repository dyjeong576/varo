import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import {
  DomainRegistryEntry,
  QueryArtifact,
  RetrievalBucket,
  ReviewRelevanceTier,
  SearchCandidate,
  TopicScope,
  buildCanonicalUrl,
  buildMockCoreClaim,
  buildMockQueries,
  buildNormalizedHash,
  classifySourceType,
  inferCountryCodeFromUrl,
  matchDomainRegistryEntry,
  normalizeCountryCode,
} from "./reviews.utils";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_TIMEOUT_MS = 300000;
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
const TAVILY_RESULTS_PER_QUERY = 5;
const MAX_EXTRACTION_CONTENT_LENGTH = 20000;
const MAX_SNIPPET_LENGTH = 320;

interface QueryRefinementResult {
  claimLanguageCode: string;
  coreClaim: string;
  generatedQueries: QueryArtifact[];
  topicScope: TopicScope;
  topicCountryCode: string | null;
  countryDetectionReason: string;
}

interface SearchSourcesInput {
  queries: QueryArtifact[];
  coreClaim: string;
  claimLanguageCode: string;
  userCountryCode: string | null;
  topicCountryCode: string | null;
  topicScope: TopicScope;
  domainRegistry: DomainRegistryEntry[];
}

interface RelevanceFilteringInput {
  coreClaim: string;
  claimLanguageCode: string;
  topicCountryCode: string | null;
  topicScope: TopicScope;
  candidates: SearchCandidate[];
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
  topicScope: TopicScope;
  topicCountryCode: string | null;
  countryDetectionReason: string;
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

interface SearchSingleQueryInput {
  apiKey: string;
  query: QueryArtifact;
  timeoutMs: number;
  bucket: RetrievalBucket;
  includeDomains?: string[];
  registry: DomainRegistryEntry[];
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
            required: [
              "languageCode",
              "coreClaim",
              "generatedQueries",
              "topicScope",
              "topicCountryCode",
              "countryDetectionReason",
            ],
            properties: {
              languageCode: { type: "string" },
              coreClaim: { type: "string" },
              generatedQueries: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3,
              },
              topicScope: {
                type: "string",
                enum: ["domestic", "foreign", "multi_country", "unknown"],
              },
              topicCountryCode: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              countryDetectionReason: { type: "string" },
            },
          },
        },
        [
          {
            role: "system",
            content: `사용자 발화에서 팩트체크가 필요한 핵심 주장을 추출하고 뉴스 검색에 최적화된 쿼리 3개를 JSON으로 반환하세요.

쿼리 작성 규칙:
- 2~4개 핵심 명사만 사용 (조사, 부사, 메타 표현 제거)
  - 나쁜 예: "테슬라 한국 완전 철수 공식 발표 여부"
  - 좋은 예: "테슬라 한국 철수"
- "여부", "가능성", "공식", "발표", "관련" 같은 메타 표현은 절대 포함하지 마세요
- 3개 쿼리는 서로 다른 각도로 작성 (동의어 변형, 주체 변경 등)
  - 예: "테슬라 한국 철수" / "테슬라 코리아 사업 중단" / "테슬라 한국 매장 폐점"
- 고유명사(기업명, 인명, 지명)는 원문 그대로 유지

languageCode는 원문 언어를 유지하세요. topicCountryCode는 핵심 뉴스/주장의 중심 국가를 ISO 3166-1 alpha-2 대문자 코드로 반환하고, 식별이 어렵다면 null을 반환하세요. topicScope는 domestic, foreign, multi_country, unknown 중 하나만 선택하세요. countryDetectionReason에는 왜 그렇게 판정했는지 짧게 설명하세요.`,
          },
          {
            role: "user",
            content: rawClaim,
          },
        ],
        "질의 정제 요청에 실패했습니다.",
      );

    const queries = payload.generatedQueries
      .map((query) =>
        query
          .trim()
          .split(/\s+/)
          .map((word) => (word.length >= 2 ? `"${word}"` : word))
          .join(" "),
      )
      .filter(Boolean);
    const topicCountryCode = normalizeCountryCode(payload.topicCountryCode);

    if (
      typeof payload.languageCode !== "string" ||
      typeof payload.coreClaim !== "string" ||
      typeof payload.countryDetectionReason !== "string" ||
      !payload.languageCode.trim() ||
      !payload.coreClaim.trim() ||
      !payload.countryDetectionReason.trim() ||
      !["domestic", "foreign", "multi_country", "unknown"].includes(
        payload.topicScope,
      ) ||
      queries.length !== 3
    ) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "질의 정제 결과가 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      claimLanguageCode: payload.languageCode.trim(),
      coreClaim: payload.coreClaim.trim(),
      generatedQueries: queries.map((query, index) => ({
        id: `q${index + 1}`,
        text: query,
        rank: index + 1,
      })),
      topicScope: payload.topicScope,
      topicCountryCode,
      countryDetectionReason: payload.countryDetectionReason.trim(),
    };
  }

  async searchSources(input: SearchSourcesInput): Promise<SearchCandidate[]> {
    const apiKey = this.getRequiredTavilyApiKey();
    const timeoutMs = this.getTavilySearchTimeoutMs();
    const requests: Promise<SearchCandidate[]>[] = [];
    const verificationDomains = this.selectDomainsForBucket(
      input.domainRegistry,
      "verification",
      input.userCountryCode,
      input.topicCountryCode,
    );

    requests.push(
      ...input.queries.map((query) =>
        this.searchSingleQuery({
          apiKey,
          query,
          timeoutMs,
          bucket: "verification",
          includeDomains: verificationDomains,
          registry: input.domainRegistry,
        }),
      ),
    );

    return requests.length ? (await Promise.all(requests)).flat() : [];
  }

  async searchFallbackSources(
    queries: QueryArtifact[],
    domainRegistry: DomainRegistryEntry[],
  ): Promise<SearchCandidate[]> {
    const apiKey = this.getRequiredTavilyApiKey();
    const timeoutMs = this.getTavilySearchTimeoutMs();
    const queryResults = await Promise.all(
      queries.map((query) =>
        this.searchSingleQuery({
          apiKey,
          query,
          timeoutMs,
          bucket: "fallback",
          registry: domainRegistry,
        }),
      ),
    );

    return queryResults.flat();
  }

  async applyRelevanceFiltering(
    input: RelevanceFilteringInput,
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
              "당신은 뉴스 검토용 relevance filter입니다. core claim, 기사 제목, snippet, 출처 유형, retrieval bucket, source country를 보고 extraction 이전 단계에서 source를 분류하세요. foreign topic에서는 한국 familiar 기사만으로 primary를 과대 부여하지 말고, verification source를 우선하세요. primary는 직접 검증 근거, reference는 보조 가치가 있는 source, discard는 관련성이 부족한 source입니다.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                coreClaim: input.coreClaim,
                claimLanguageCode: input.claimLanguageCode,
                topicCountryCode: input.topicCountryCode,
                topicScope: input.topicScope,
                candidates: input.candidates.map((candidate) => ({
                  candidateId: candidate.id,
                  title: candidate.rawTitle,
                  snippet: candidate.rawSnippet,
                  publisherName: candidate.publisherName,
                  sourceType: candidate.sourceType,
                  canonicalUrl: candidate.canonicalUrl,
                  retrievalBucket: candidate.retrievalBucket,
                  sourceCountryCode: candidate.sourceCountryCode,
                })),
              },
              null,
              2,
            ),
          },
        ],
        "관련성 필터링 요청에 실패했습니다.",
      );

    if (!this.isValidRelevancePayload(payload, input.candidates)) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "관련성 필터링 결과가 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    const decisions = new Map(
      payload.decisions.map((decision) => [decision.candidateId, decision]),
    );

    return input.candidates.map((candidate) => {
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

  private selectDomainsForBucket(
    registry: DomainRegistryEntry[],
    bucket: "familiar" | "verification",
    userCountryCode: string | null,
    topicCountryCode: string | null,
  ): string[] {
    const usageRoles =
      bucket === "familiar"
        ? ["familiar_news"]
        : ["verification_official", "verification_news", "global_reference"];
    const allowedCountries =
      bucket === "familiar"
        ? [userCountryCode].filter((value): value is string => Boolean(value))
        : [topicCountryCode, "GLOBAL"].filter((value): value is string =>
            Boolean(value),
          );

    return registry
      .filter(
        (entry) =>
          entry.isActive &&
          usageRoles.includes(entry.usageRole) &&
          allowedCountries.includes(entry.countryCode),
      )
      .sort((left, right) => left.priority - right.priority)
      .map((entry) => entry.domain)
      .filter((domain, index, domains) => domains.indexOf(domain) === index);
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
    input: SearchSingleQueryInput,
  ): Promise<SearchCandidate[]> {
    const httpState = {
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
    };
    const response = await this.postJson<TavilySearchResponse>(
      TAVILY_SEARCH_URL,
      httpState,
      input.timeoutMs,
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
        const registryMatch = matchDomainRegistryEntry(
          canonicalUrl,
          input.registry,
        );

        return {
          id: `${input.query.id}-${input.bucket}-c${index + 1}`,
          sourceType: classifySourceType(canonicalUrl, rawTitle),
          publisherName: this.inferPublisherName(canonicalUrl),
          publishedAt: this.readPublishedAt(result),
          canonicalUrl,
          originalUrl,
          rawTitle,
          rawSnippet,
          normalizedHash: buildNormalizedHash(canonicalUrl),
          originQueryIds: [input.query.id],
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
    const claimLanguageCode = /[가-힣]/.test(rawClaim) ? "ko" : "en";
    const coreClaim = buildMockCoreClaim(rawClaim);
    const normalizedClaim = rawClaim.toLowerCase();
    let topicScope: TopicScope = "unknown";
    let topicCountryCode: string | null = null;
    let countryDetectionReason =
      "명시적인 국가 단서가 부족해 unknown으로 처리했습니다.";

    if (/(한국|대한민국|국내|대통령실|정부|서울)/u.test(rawClaim)) {
      topicScope = "domestic";
      topicCountryCode = "KR";
      countryDetectionReason =
        "한국 관련 고유명사와 기관 표현이 확인되어 국내 이슈로 판단했습니다.";
    } else if (
      /(미국|트럼프|백악관|washington|united states|america)/i.test(
        normalizedClaim,
      )
    ) {
      topicScope = "foreign";
      topicCountryCode = "US";
      countryDetectionReason =
        "미국 정치 또는 기관 단서가 확인되어 미국 이슈로 판단했습니다.";
    } else if (/(일본|도쿄|기시다|japan|tokyo)/i.test(normalizedClaim)) {
      topicScope = "foreign";
      topicCountryCode = "JP";
      countryDetectionReason =
        "일본 관련 고유명사 단서가 확인되어 일본 이슈로 판단했습니다.";
    }

    return {
      claimLanguageCode,
      coreClaim,
      generatedQueries: buildMockQueries(coreClaim, claimLanguageCode),
      topicScope,
      topicCountryCode,
      countryDetectionReason,
    };
  }


  private buildMockFallbackSearchResults(
    queries: QueryArtifact[],
    domainRegistry: DomainRegistryEntry[],
  ): SearchCandidate[] {
    const fallbackResults = [
      {
        title: "국제 통신 보도",
        snippet: "fallback 검색으로 확보한 국제 보도입니다.",
        url: "https://www.reuters.com/world/fallback-coverage",
      },
      {
        title: "공식 기관 업데이트",
        snippet: "fallback 검색으로 확보한 공식 출처입니다.",
        url: "https://www.whitehouse.gov/briefing-room/fallback-update",
      },
    ];

    return queries.flatMap((query, index) =>
      fallbackResults.map((result, resultIndex) => {
        const canonicalUrl = buildCanonicalUrl(result.url);
        const registryMatch = matchDomainRegistryEntry(
          canonicalUrl,
          domainRegistry,
        );

        return {
          id: `${query.id}-fallback-c${index + resultIndex + 1}`,
          sourceType: classifySourceType(canonicalUrl, result.title),
          publisherName: this.inferPublisherName(canonicalUrl),
          publishedAt: new Date(
            Date.now() - (index + resultIndex + 1) * 30 * 60 * 1000,
          ).toISOString(),
          canonicalUrl,
          originalUrl: result.url,
          rawTitle: result.title,
          rawSnippet: result.snippet,
          normalizedHash: buildNormalizedHash(canonicalUrl),
          originQueryIds: [query.id],
          sourceCountryCode:
            registryMatch?.countryCode === "GLOBAL"
              ? null
              : (registryMatch?.countryCode ??
                inferCountryCodeFromUrl(canonicalUrl)),
          retrievalBucket: "fallback",
          domainRegistryId: registryMatch?.id ?? null,
        };
      }),
    );
  }
}
