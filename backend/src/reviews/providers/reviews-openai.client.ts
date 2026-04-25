import { HttpStatus, Injectable } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import {
  QueryArtifact,
  QueryRefinementResult,
  RelevanceFilteringInput,
  ReviewRelevanceTier,
  SearchCandidate,
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

interface OpenAiQueryRefinementPayload {
  languageCode: string;
  coreClaim: string;
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
            content: `사용자 발화에서 팩트체크가 필요한 핵심 주장을 추출하고 뉴스 검색에 최적화된 쿼리 3개를 JSON으로 반환하세요.

쿼리 작성 규칙:
- 2~4개 핵심 명사만 사용 (조사, 부사, 메타 표현 제거)
  - 나쁜 예: "테슬라 한국 완전 철수 공식 발표 여부"
  - 좋은 예: "테슬라 한국 철수"
- generatedQueries 3개는 사용자-facing trace용이므로 원문 언어를 유지하세요.
- "여부", "가능성", "공식", "발표", "관련" 같은 메타 표현은 절대 포함하지 마세요
- 3개 쿼리는 서로 다른 각도로 작성 (동의어 변형, 주체 변경 등)
  - 예: "테슬라 한국 철수" / "테슬라 코리아 사업 중단" / "테슬라 한국 매장 폐점"
- 고유명사(기업명, 인명, 지명)는 원문 그대로 유지

languageCode는 원문 언어를 유지하세요. topicCountryCode는 사용자 프로필 국가가 아니라 claim/context 의미 기준의 중심 국가를 ISO 3166-1 alpha-2 대문자 코드로 반환하고, 식별이 어렵다면 null을 반환하세요. topicScope는 domestic, foreign, multi_country, unknown 중 하나만 선택하세요. countryDetectionReason에는 왜 그렇게 판정했는지 짧게 설명하세요.

searchRoute는 korean_news, global_news, unsupported 중 하나만 반환하세요.
- korean_news: 한국 뉴스성 claim. Naver News Search를 사용합니다.
- global_news: 해외/글로벌 뉴스성 claim. Tavily Search를 사용합니다.
- unsupported: 뉴스성 또는 사실성 검토 대상이 아니거나 provider로 근거 수집이 어렵습니다.

searchRouteReason에는 route 선택 이유를 짧게 설명하세요.
searchClaim과 searchQueries는 실제 검색 provider에 전달할 입력입니다.
- korean_news: searchClaim/searchQueries를 generatedQueries와 같은 언어 맥락으로 작성하세요.
- global_news: searchClaim/searchQueries를 자연스러운 영어로 번역하세요. 날짜, 수치, 고유명사는 유지하세요.
- unsupported: searchClaim/searchQueries는 generatedQueries와 같은 맥락으로 채우되 실제 검색에는 사용되지 않습니다.

isKoreaRelated는 UX/설명용 메타데이터입니다. claim 자체에 한국 장소, 한국 정부/기관, 한국 기업/법인, 한국 시장, 한국 국민/이용자, 한국 정책, 국내 서비스 영향이 직접 포함되면 true입니다. 단순히 해외 이슈가 한국어로 보도됐다는 이유만으로 true로 두지 마세요. koreaRelevanceReason에는 한국 관련성을 인정하거나 제외한 이유를 짧게 설명하세요.`,
          },
          {
            role: "user",
            content: rawClaim,
          },
        ],
        "질의 정제 요청에 실패했습니다.",
      );

    const queries = this.normalizeQueries(payload.generatedQueries);
    const searchQueries = this.normalizeQueries(payload.searchQueries);
    const topicCountryCode = normalizeCountryCode(payload.topicCountryCode);

    if (
      typeof payload.languageCode !== "string" ||
      typeof payload.coreClaim !== "string" ||
      typeof payload.searchRoute !== "string" ||
      typeof payload.searchRouteReason !== "string" ||
      typeof payload.searchClaim !== "string" ||
      typeof payload.countryDetectionReason !== "string" ||
      typeof payload.isKoreaRelated !== "boolean" ||
      typeof payload.koreaRelevanceReason !== "string" ||
      !payload.languageCode.trim() ||
      !payload.coreClaim.trim() ||
      !SEARCH_ROUTES.includes(payload.searchRoute) ||
      !payload.searchRouteReason.trim() ||
      !payload.searchClaim.trim() ||
      !payload.countryDetectionReason.trim() ||
      !payload.koreaRelevanceReason.trim() ||
      !["domestic", "foreign", "multi_country", "unknown"].includes(
        payload.topicScope,
      ) ||
      queries.length !== 3 ||
      searchQueries.length !== 3
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
      generatedQueries: this.toQueryArtifacts(queries),
      searchRoute: payload.searchRoute,
      searchRouteReason: payload.searchRouteReason.trim(),
      searchClaim: payload.searchClaim.trim(),
      searchQueries: this.toQueryArtifacts(searchQueries),
      topicScope: payload.topicScope,
      topicCountryCode,
      countryDetectionReason: payload.countryDetectionReason.trim(),
      isKoreaRelated: payload.isKoreaRelated,
      koreaRelevanceReason: payload.koreaRelevanceReason.trim(),
    };
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

  private normalizeQueries(queries: string[]): string[] {
    return queries
      .map((query) =>
        query
          .trim()
          .split(/\s+/)
          .map((word) => (word.length >= 2 ? `"${word}"` : word))
          .join(" "),
      )
      .filter(Boolean);
  }

  private toQueryArtifacts(queries: string[]): QueryArtifact[] {
    return queries.map((query, index) => ({
      id: `q${index + 1}`,
      text: query,
      rank: index + 1,
    }));
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
