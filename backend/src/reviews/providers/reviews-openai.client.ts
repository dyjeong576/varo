import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import {
  QueryPurpose,
  QueryArtifact,
  QueryRefinementResult,
  ReviewClaimType,
  RelevanceFilteringInput,
  ReviewRelevanceTier,
  SearchCandidate,
  SearchPlan,
  SearchPlanQueryArtifact,
  SearchRoute,
  TopicScope,
} from "../reviews.types";
import { normalizeCountryCode } from "../reviews.utils";
import { postJson } from "./reviews-provider-http";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_TIMEOUT_MS = 300000;
const SEARCH_ROUTES: SearchRoute[] = [
  "korean_news",
  "global_news",
  "unsupported",
];
const CLAIM_TYPES: ReviewClaimType[] = [
  "scheduled_event",
  "current_status",
  "statistic",
  "quote",
  "policy",
  "corporate_action",
  "incident",
  "general_fact",
];
const QUERY_PURPOSES: QueryPurpose[] = [
  "claim_specific",
  "current_state",
  "primary_source",
  "contradiction_or_update",
];

interface OpenAiSearchPlanQueryPayload {
  id: string;
  purpose: QueryPurpose;
  query: string;
  priority: number;
}

interface OpenAiSearchPlanPayload {
  normalizedClaim: string;
  claimType: ReviewClaimType;
  verificationGoal: string;
  searchRoute: SearchRoute;
  queries: OpenAiSearchPlanQueryPayload[];
}

interface OpenAiQueryRefinementPayload {
  languageCode: string;
  coreClaim: string;
  normalizedClaim: string;
  claimType: ReviewClaimType;
  verificationGoal: string;
  searchPlan: OpenAiSearchPlanPayload;
  generatedQueries: string[];
  searchRoute: SearchRoute;
  searchRouteReason: string;
  searchClaim: string;
  searchQueries: string[];
  topicScope: TopicScope;
  topicCountryCode: string | null;
  countryDetectionReason: string;
  isKoreaRelated: boolean;
  koreaRelevanceReason: string;
}

interface OpenAiRelevanceDecision {
  candidateId: string;
  relevanceTier: ReviewRelevanceTier;
  relevanceReason: string;
}

interface OpenAiRelevancePayload {
  decisions: OpenAiRelevanceDecision[];
}

@Injectable()
export class ReviewsOpenAiClient {
  private readonly logger = new Logger(ReviewsOpenAiClient.name);

  async refineQuery(
    apiKey: string,
    rawClaim: string,
  ): Promise<QueryRefinementResult> {
    const payload =
      await this.requestStructuredOutput<OpenAiQueryRefinementPayload>(
        apiKey,
        {
          name: "review_query_refinement",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "languageCode",
              "coreClaim",
              "normalizedClaim",
              "claimType",
              "verificationGoal",
              "searchPlan",
              "generatedQueries",
              "searchRoute",
              "searchRouteReason",
              "searchClaim",
              "searchQueries",
              "topicScope",
              "topicCountryCode",
              "countryDetectionReason",
              "isKoreaRelated",
              "koreaRelevanceReason",
            ],
            properties: {
              languageCode: { type: "string" },
              coreClaim: { type: "string" },
              normalizedClaim: { type: "string" },
              claimType: {
                type: "string",
                enum: CLAIM_TYPES,
              },
              verificationGoal: { type: "string" },
              searchPlan: {
                type: "object",
                additionalProperties: false,
                required: [
                  "normalizedClaim",
                  "claimType",
                  "verificationGoal",
                  "searchRoute",
                  "queries",
                ],
                properties: {
                  normalizedClaim: { type: "string" },
                  claimType: {
                    type: "string",
                    enum: CLAIM_TYPES,
                  },
                  verificationGoal: { type: "string" },
                  searchRoute: {
                    type: "string",
                    enum: SEARCH_ROUTES,
                  },
                  queries: {
                    type: "array",
                    minItems: 4,
                    maxItems: 4,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["id", "purpose", "query", "priority"],
                      properties: {
                        id: { type: "string" },
                        purpose: {
                          type: "string",
                          enum: QUERY_PURPOSES,
                        },
                        query: { type: "string" },
                        priority: { type: "number" },
                      },
                    },
                  },
                },
              },
              generatedQueries: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3,
              },
              searchRoute: {
                type: "string",
                enum: SEARCH_ROUTES,
              },
              searchRouteReason: { type: "string" },
              searchClaim: { type: "string" },
              searchQueries: {
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
              isKoreaRelated: { type: "boolean" },
              koreaRelevanceReason: { type: "string" },
            },
          },
        },
        [
          {
            role: "system",
            content: `사용자 발화에서 팩트체크가 필요한 핵심 주장을 추출하고, 검증 목적별 search plan을 JSON으로 반환하세요. 사용자의 발화에 포함된 키워드를 그대로 뽑지 말고, 현재 기준 검증에 필요한 검색 관점을 설계하세요.

claim 이해 규칙:
- coreClaim은 검토 대상 핵심 주장입니다.
- normalizedClaim은 검증 가능한 형태로 정규화한 claim입니다.
- claimType은 scheduled_event, current_status, statistic, quote, policy, corporate_action, incident, general_fact 중 하나입니다.
- verificationGoal은 "현재 수집 가능한 출처 기준으로 무엇을 확인해야 하는지"를 짧게 씁니다.

searchPlan 작성 규칙:
- searchPlan은 normalizedClaim, claimType, verificationGoal, searchRoute, queries를 포함합니다.
- searchPlan.queries는 정확히 4개이며 purpose가 각각 claim_specific, current_state, primary_source, contradiction_or_update여야 합니다.
- claim_specific은 사용자가 말한 claim 자체가 어떤 출처에서 나왔는지 확인하는 query입니다.
- current_state는 현재 기준 상태 또는 최신 보도를 확인하는 query입니다.
- primary_source는 공식 발표, 원문, 공시, 기관 문서 등 1차 출처를 찾는 query입니다.
- contradiction_or_update는 반박, 정정, 변경, 취소, 업데이트 신호를 찾는 query입니다.
- query는 검색 provider에 바로 전달할 자연스러운 검색어입니다. 단어별 따옴표나 불필요한 메타 표현을 붙이지 마세요.
- 고유명사, 날짜, 수치는 claim 구조화에는 보존하되, 검색 질의가 사용자 표현에만 갇히지 않도록 작성하세요.

호환 필드 작성 규칙:
- generatedQueries 3개는 사용자-facing trace용이므로 원문 언어를 유지하세요.
- searchClaim과 searchQueries는 기존 호환용 검색 입력입니다.
- korean_news: searchClaim/searchQueries를 원문 언어 맥락으로 작성하세요.
- global_news: searchClaim/searchQueries와 searchPlan.queries의 query를 자연스러운 영어로 작성하세요. 날짜, 수치, 고유명사는 유지하세요.
- unsupported: searchClaim/searchQueries는 generatedQueries와 같은 맥락으로 채우되 실제 검색에는 사용되지 않습니다.

languageCode는 원문 언어를 유지하세요. topicCountryCode는 사용자 프로필 국가가 아니라 claim/context 의미 기준의 중심 국가를 ISO 3166-1 alpha-2 대문자 코드로 반환하고, 식별이 어렵다면 null을 반환하세요. topicScope는 domestic, foreign, multi_country, unknown 중 하나만 선택하세요. countryDetectionReason에는 왜 그렇게 판정했는지 짧게 설명하세요.

searchRoute는 korean_news, global_news, unsupported 중 하나만 반환하세요.
- korean_news: 한국 뉴스성 claim. Naver News Search를 사용합니다.
- global_news: 해외/글로벌 뉴스성 claim. Tavily Search를 사용합니다.
- unsupported: 뉴스성 또는 사실성 검토 대상이 아니거나 provider로 근거 수집이 어렵습니다.

searchRouteReason에는 route 선택 이유를 짧게 설명하세요.

isKoreaRelated는 UX/설명용 메타데이터입니다. claim 자체에 한국 장소, 한국 정부/기관, 한국 기업/법인, 한국 시장, 한국 국민/이용자, 한국 정책, 국내 서비스 영향이 직접 포함되면 true입니다. 단순히 해외 이슈가 한국어로 보도됐다는 이유만으로 true로 두지 마세요. koreaRelevanceReason에는 한국 관련성을 인정하거나 제외한 이유를 짧게 설명하세요.`,
          },
          {
            role: "user",
            content: rawClaim,
          },
        ],
        "질의 정제 요청에 실패했습니다.",
      );

    const coreClaim = this.normalizeText(payload.coreClaim, rawClaim);
    const normalizedClaim = this.normalizeText(payload.normalizedClaim, coreClaim);
    const claimType = CLAIM_TYPES.includes(payload.claimType)
      ? payload.claimType
      : "general_fact";
    const verificationGoal = this.normalizeText(
      payload.verificationGoal,
      "현재 수집 가능한 출처 기준으로 claim을 검토합니다.",
    );
    const searchRoute = SEARCH_ROUTES.includes(payload.searchRoute)
      ? payload.searchRoute
      : "unsupported";
    const queries = this.normalizeQueries(payload.generatedQueries, [
      normalizedClaim,
      coreClaim,
      rawClaim,
    ]);
    const searchQueries = this.normalizeQueries(payload.searchQueries, queries);
    const searchPlan = this.normalizeSearchPlan(payload, {
      normalizedClaim,
      claimType,
      verificationGoal,
      searchRoute,
      fallbackQueries: searchQueries,
    });
    const topicCountryCode = normalizeCountryCode(payload.topicCountryCode);

    const result = {
      claimLanguageCode: this.normalizeText(payload.languageCode, "unknown"),
      coreClaim,
      normalizedClaim,
      claimType,
      verificationGoal,
      searchPlan,
      generatedQueries: this.toQueryArtifacts(queries),
      searchRoute,
      searchRouteReason: this.normalizeText(
        payload.searchRouteReason,
        "검색 route 판정 이유가 기록되지 않았습니다.",
      ),
      searchClaim: this.normalizeText(payload.searchClaim, normalizedClaim),
      searchQueries: this.toQueryArtifacts(searchQueries),
      topicScope: this.normalizeTopicScope(payload.topicScope),
      topicCountryCode,
      countryDetectionReason: this.normalizeText(
        payload.countryDetectionReason,
        "주제 국가 판정 이유가 기록되지 않았습니다.",
      ),
      isKoreaRelated:
        typeof payload.isKoreaRelated === "boolean" ? payload.isKoreaRelated : false,
      koreaRelevanceReason: this.normalizeText(
        payload.koreaRelevanceReason,
        "한국 관련성 판정 이유가 기록되지 않았습니다.",
      ),
    };

    this.logGeneratedSearchQueries(result);

    return result;
  }

  async applyRelevanceFiltering(
    apiKey: string,
    input: RelevanceFilteringInput,
  ): Promise<SearchCandidate[]> {
    const payload =
      await this.requestStructuredOutput<OpenAiRelevancePayload>(
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
              "당신은 VARO 뉴스 근거 수집 relevance filter입니다. search route, provider, core claim, 기사 제목, snippet, 출처 유형, retrieval bucket, source country를 보고 extraction 이전 단계에서 source를 분류하세요. primary는 직접 검증 근거, reference는 보조 가치가 있는 source, discard는 관련성이 부족한 source입니다.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                coreClaim: input.coreClaim,
                claimLanguageCode: input.claimLanguageCode,
                searchRoute: input.searchRoute,
                topicCountryCode: input.topicCountryCode,
                topicScope: input.topicScope,
                candidates: input.candidates.map((candidate) => ({
                  candidateId: candidate.id,
                  searchRoute: candidate.searchRoute,
                  sourceProvider: candidate.sourceProvider,
                  title: candidate.rawTitle,
                  snippet: candidate.rawSnippet,
                  originQueryIds: candidate.originQueryIds,
                  originQueryPurposes: candidate.originQueryPurposes ?? [],
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

  private normalizeText(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback.trim();
  }

  private normalizeTopicScope(value: unknown): TopicScope {
    return value === "domestic" ||
      value === "foreign" ||
      value === "multi_country" ||
      value === "unknown"
      ? value
      : "unknown";
  }

  private normalizeQueries(queries: unknown, fallbackQueries: string[] = []): string[] {
    const values = Array.isArray(queries) ? queries : [];
    const normalized = [...values, ...fallbackQueries]
      .filter((query): query is string => typeof query === "string")
      .map((query) => query.trim().replace(/\s+/g, " "))
      .filter(Boolean);

    const deduped = Array.from(new Set(normalized));
    const fallback = deduped[0] ?? "뉴스 검증";

    while (deduped.length < 3) {
      deduped.push(`${fallback} ${deduped.length + 1}`);
    }

    return deduped.slice(0, 3);
  }

  private normalizeSearchPlan(
    payload: OpenAiQueryRefinementPayload,
    fallback: {
      normalizedClaim: string;
      claimType: ReviewClaimType;
      verificationGoal: string;
      searchRoute: SearchRoute;
      fallbackQueries: string[];
    },
  ): SearchPlan {
    const plan = payload.searchPlan;
    const seenIds = new Set<string>();
    const seenPurposes = new Set<QueryPurpose>();
    const queriesByPurpose = new Map<QueryPurpose, SearchPlanQueryArtifact>();

    for (const query of Array.isArray(plan?.queries) ? plan.queries : []) {
      if (
        !query ||
        typeof query.id !== "string" ||
        typeof query.query !== "string" ||
        typeof query.priority !== "number" ||
        !Number.isFinite(query.priority) ||
        !QUERY_PURPOSES.includes(query.purpose)
      ) {
        continue;
      }

      const id = query.id.trim();
      const queryText = query.query.trim().replace(/\s+/g, " ");

      if (!id || !queryText || seenIds.has(id) || seenPurposes.has(query.purpose)) {
        continue;
      }

      seenIds.add(id);
      seenPurposes.add(query.purpose);
      queriesByPurpose.set(query.purpose, {
        id,
        purpose: query.purpose,
        query: queryText,
        priority: query.priority,
      });
    }

    const queries = QUERY_PURPOSES.map((purpose, index) => {
      const query = queriesByPurpose.get(purpose);

      if (query) {
        return query;
      }

      return {
        id: `sp${index + 1}`,
        purpose,
        query:
          fallback.fallbackQueries[index] ??
          fallback.fallbackQueries[0] ??
          fallback.normalizedClaim,
        priority: index + 1,
      };
    });

    return {
      normalizedClaim: fallback.normalizedClaim,
      claimType: fallback.claimType,
      verificationGoal: fallback.verificationGoal,
      searchRoute: fallback.searchRoute,
      queries: queries.sort((left, right) => left.priority - right.priority),
    };
  }

  private toQueryArtifacts(queries: string[]): QueryArtifact[] {
    return queries.map((query, index) => ({
      id: `q${index + 1}`,
      text: query,
      rank: index + 1,
    }));
  }

  private logGeneratedSearchQueries(result: QueryRefinementResult): void {
    this.logger.log(
      `OpenAI generated search queries: ${JSON.stringify({
        searchRoute: result.searchRoute,
        claimType: result.claimType,
        normalizedClaim: result.normalizedClaim,
        searchPlanQueries: result.searchPlan.queries.map((query) => ({
          id: query.id,
          purpose: query.purpose,
          query: query.query,
          priority: query.priority,
        })),
        compatGeneratedQueries: result.generatedQueries.map((query) => query.text),
        compatSearchQueries: result.searchQueries.map((query) => query.text),
      })}`,
    );
  }

  private async requestStructuredOutput<T>(
    apiKey: string,
    schema: { name: string; schema: Record<string, unknown> },
    input: Array<{ role: "system" | "user"; content: string }>,
    errorMessage: string,
  ): Promise<T> {
    const response = await postJson<unknown>(
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

    return this.parseStructuredOutput<T>(response);
  }

  private parseStructuredOutput<T>(response: unknown): T {
    const refusal = this.extractRefusalText(response);

    if (refusal) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "OpenAI가 구조화된 출력을 반환하지 않았습니다.",
        HttpStatus.BAD_GATEWAY,
        { refusal },
      );
    }

    const outputText = this.extractOutputText(response);

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

  private extractOutputText(response: unknown): string {
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
}
