import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import {
  QueryPurpose,
  QueryArtifact,
  EvidenceSignal,
  EvidenceSignalClassificationInput,
  EvidenceSignalImpact,
  EvidenceSignalStance,
  EvidenceSignalTemporalRole,
  EvidenceSignalUpdateType,
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
const SEARCH_ROUTES: SearchRoute[] = ["korean_news", "unsupported"];
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
const EVIDENCE_SIGNAL_STANCES: EvidenceSignalStance[] = [
  "supports",
  "contradicts",
  "updates",
  "context",
  "unknown",
];
const EVIDENCE_SIGNAL_TEMPORAL_ROLES: EvidenceSignalTemporalRole[] = [
  "past_plan",
  "current_status",
  "latest_update",
  "official_statement",
  "background",
];
const EVIDENCE_SIGNAL_UPDATE_TYPES: EvidenceSignalUpdateType[] = [
  "delay",
  "cancellation",
  "correction",
  "confirmation",
  "none",
];
const EVIDENCE_SIGNAL_IMPACTS: EvidenceSignalImpact[] = [
  "strengthens",
  "weakens",
  "overrides",
  "neutral",
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
  searchRoute: SearchRoute;
  searchRouteReason: string;
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

interface OpenAiEvidenceSignalDecision {
  sourceId: string;
  stanceToClaim: EvidenceSignalStance;
  temporalRole: EvidenceSignalTemporalRole;
  updateType: EvidenceSignalUpdateType;
  currentAnswerImpact: EvidenceSignalImpact;
  reason: string;
}

interface OpenAiEvidenceSignalPayload {
  signals: OpenAiEvidenceSignalDecision[];
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
              "searchRoute",
              "searchRouteReason",
              "searchPlan",
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
              searchRoute: {
                type: "string",
                enum: SEARCH_ROUTES,
              },
              searchRouteReason: { type: "string" },
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
            content: `사용자 발화에서 팩트체크가 필요한 핵심 주장을 분석하고, 분석 가능 여부와 검색 계획을 한 번에 판정해 JSON으로 반환하세요.

[1단계] 핵심 주장 이해
- coreClaim: 검토 대상 핵심 주장
- normalizedClaim: 검증 가능한 형태로 정규화한 주장
- claimType: scheduled_event | current_status | statistic | quote | policy | corporate_action | incident | general_fact
- verificationGoal: 현재 수집 가능한 출처로 무엇을 확인해야 하는지를 짧게

[2단계] 분석 가능 여부 판정 (searchRoute)
korean_news 조건: 한국 관련 정치·경제 뉴스성 claim
- 한국 장소, 정부/기관, 기업/법인, 시장, 국민/이용자, 정책, 국내 서비스 영향이 claim 자체에 직접 포함
- 출처로 검증 가능한 사실성 주장 (정치인 발언, 정당 입장, 정책, 공약, 법안, 기업 공시, 경제 지표 등)

unsupported 조건: 아래 중 하나라도 해당
- 한국 관련성 없음, 해외/글로벌 뉴스
- 의료, 연예, 스포츠, 개인 상담, 투자 추천, 순수 의견, 미래 예측
- 정치·경제 도메인 밖이거나 provider로 근거 수집이 어려움
해외뉴스 요청은 searchRouteReason에 "VARO가 현재 한국 뉴스만 분석한다"고 설명하세요.

[3단계] 검색 계획 (searchPlan)
korean_news인 경우에만 queries를 정확히 4개 작성하세요. unsupported면 queries는 빈 배열입니다.

네이버 뉴스 검색 쿼리 작성 원칙:
- 각 query는 기사 제목에 실제로 등장할 법한 핵심 키워드 조합을 사용하세요.
- 인물명·직책·기관명·기업명은 한국어로 정확히 작성하세요. (예: "이재명 대표", "삼성전자", "기획재정부")
- 쿼리 한 개는 10~20자 이내의 단문 키워드 조합으로, 조사와 접속어를 최소화하세요.
- 4개 쿼리 간 핵심 키워드 중복을 최소화해서 서로 다른 각도를 커버하세요.
- purpose별 작성 방법:
  - claim_specific: 사용자가 말한 주장이 어느 출처에서 나왔는지 찾는 쿼리. 고유명사 + 핵심 행위.
  - current_state: 현재 기준 최신 상태/보도를 확인하는 쿼리. 현재 시점 키워드 포함.
  - primary_source: 공식 발표, 공시, 기관 문서를 찾는 쿼리. "공식", "발표", "공시" 등의 키워드 포함.
  - contradiction_or_update: 반박, 정정, 변경, 취소 신호를 찾는 쿼리. "취소", "번복", "정정", "부인" 등의 키워드 포함.

예시 — "하정우 수석이 국회의원 출마하는 게 사실이야?":
  claim_specific: "하정우 수석 국회의원 출마"
  current_state: "하정우 수석 총선 출마 여부 최신"
  primary_source: "하정우 수석 출마 공식 발표"
  contradiction_or_update: "하정우 수석 출마 부인 취소"

[4단계] 메타데이터
- languageCode: 원문 언어 코드
- topicCountryCode: claim 의미 기준 중심 국가 ISO 3166-1 alpha-2 대문자 코드 (식별 불가면 null)
- topicScope: domestic | foreign | multi_country | unknown
- countryDetectionReason: 판정 이유 짧게
- isKoreaRelated: claim 자체에 한국 관련 요소가 직접 포함되면 true (단순 한국어 보도는 false)
- koreaRelevanceReason: 한국 관련성 인정/제외 이유 짧게`,
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
    const searchRoute = payload.searchRoute === "korean_news" ? "korean_news" : "unsupported";
    const topicCountryCode = normalizeCountryCode(payload.topicCountryCode);
    const topicScope = this.normalizeTopicScope(payload.topicScope);

    let searchPlan: SearchPlan;
    let generatedQueries: QueryArtifact[];
    let searchQueries: QueryArtifact[];

    if (searchRoute === "unsupported") {
      searchPlan = { normalizedClaim, claimType, verificationGoal, searchRoute: "unsupported", queries: [] };
      generatedQueries = [{ id: "q1", text: coreClaim, rank: 1 }];
      searchQueries = [];
    } else {
      searchPlan = this.normalizeSearchPlan(payload, {
        normalizedClaim,
        claimType,
        verificationGoal,
        searchRoute,
        fallbackQueries: [normalizedClaim, coreClaim, rawClaim],
      });
      searchQueries = this.toSearchQueryArtifacts(searchPlan.queries);
      generatedQueries = searchQueries.slice(0, 3);
    }

    const result: QueryRefinementResult = {
      claimLanguageCode: this.normalizeText(payload.languageCode, "unknown"),
      coreClaim,
      normalizedClaim,
      claimType,
      verificationGoal,
      searchPlan,
      generatedQueries,
      searchRoute,
      searchRouteReason: this.normalizeText(
        payload.searchRouteReason,
        "검색 route 판정 이유가 기록되지 않았습니다.",
      ),
      searchClaim: normalizedClaim,
      searchQueries,
      topicScope,
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

  async classifyEvidenceSignals(
    apiKey: string,
    input: EvidenceSignalClassificationInput,
  ): Promise<EvidenceSignal[]> {
    if (input.sources.length === 0) {
      return [];
    }

    const payload =
      await this.requestStructuredOutput<OpenAiEvidenceSignalPayload>(
        apiKey,
        {
          name: "review_evidence_signal_classification",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["signals"],
            properties: {
              signals: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "sourceId",
                    "stanceToClaim",
                    "temporalRole",
                    "updateType",
                    "currentAnswerImpact",
                    "reason",
                  ],
                  properties: {
                    sourceId: { type: "string" },
                    stanceToClaim: {
                      type: "string",
                      enum: EVIDENCE_SIGNAL_STANCES,
                    },
                    temporalRole: {
                      type: "string",
                      enum: EVIDENCE_SIGNAL_TEMPORAL_ROLES,
                    },
                    updateType: {
                      type: "string",
                      enum: EVIDENCE_SIGNAL_UPDATE_TYPES,
                    },
                    currentAnswerImpact: {
                      type: "string",
                      enum: EVIDENCE_SIGNAL_IMPACTS,
                    },
                    reason: { type: "string" },
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
              "당신은 VARO evidence signal classifier입니다. 사실 결론을 내리지 말고, 수집된 출처와 근거 스니펫이 사용자의 핵심 claim에 대해 어떤 역할을 하는지만 구조화하세요. scheduled_event에서는 과거 예정 보도와 현재 상태/최신 변경 보도를 구분하고, 최신 연기/취소/정정 신호가 기존 claim을 약화하거나 대체하는지 표시하세요. 공식 발표 여부는 sourceType과 제목/스니펫에 근거해 official_statement로만 표시하세요.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                coreClaim: input.coreClaim,
                claimLanguageCode: input.claimLanguageCode,
                searchPlan: input.searchPlan,
                sources: input.sources,
              },
              null,
              2,
            ),
          },
        ],
        "evidence signal 분류 요청에 실패했습니다.",
      );

    if (!this.isValidEvidenceSignalPayload(payload, input)) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "evidence signal 분류 결과가 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload.signals.map((signal) => ({
      sourceId: signal.sourceId,
      snippetId: null,
      stanceToClaim: signal.stanceToClaim,
      temporalRole: signal.temporalRole,
      updateType: signal.updateType,
      currentAnswerImpact: signal.currentAnswerImpact,
      reason: this.normalizeText(signal.reason, "signal 분류 이유가 누락되었습니다."),
    }));
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

  private toSearchQueryArtifacts(queries: SearchPlanQueryArtifact[]): QueryArtifact[] {
    return queries.map((query) => ({
      id: query.id,
      text: query.query,
      rank: query.priority,
      purpose: query.purpose,
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

    return true;
  }

  private isValidEvidenceSignalPayload(
    payload: OpenAiEvidenceSignalPayload,
    input: EvidenceSignalClassificationInput,
  ): payload is OpenAiEvidenceSignalPayload {
    if (!payload || !Array.isArray(payload.signals)) {
      return false;
    }

    const sourceIds = new Set(input.sources.map((source) => source.sourceId));
    const seenIds = new Set<string>();

    for (const signal of payload.signals) {
      if (
        !signal ||
        typeof signal.sourceId !== "string" ||
        typeof signal.reason !== "string" ||
        !EVIDENCE_SIGNAL_STANCES.includes(signal.stanceToClaim) ||
        !EVIDENCE_SIGNAL_TEMPORAL_ROLES.includes(signal.temporalRole) ||
        !EVIDENCE_SIGNAL_UPDATE_TYPES.includes(signal.updateType) ||
        !EVIDENCE_SIGNAL_IMPACTS.includes(signal.currentAnswerImpact)
      ) {
        return false;
      }

      if (!sourceIds.has(signal.sourceId) || seenIds.has(signal.sourceId)) {
        return false;
      }

      seenIds.add(signal.sourceId);
    }

    return seenIds.size === sourceIds.size;
  }
}
