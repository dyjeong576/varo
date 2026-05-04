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
  AnswerCheckType,
  AnswerMode,
  RelevanceSignalClassificationInput,
  RelevanceSignalClassificationResult,
  AnswerRelevanceTier,
  SearchCandidate,
  SearchPlan,
  SearchPlanQueryArtifact,
  SearchRoute,
  AnswerGeneratedSummary,
} from "../answers.types";
import { postJson } from "./answers-provider-http";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_TIMEOUT_MS = 300000;
const QUERY_REFINEMENT_MAX_OUTPUT_TOKENS = 1000;
const RELEVANCE_SIGNAL_MAX_OUTPUT_TOKENS = 3200;
const SEARCH_ROUTES: SearchRoute[] = ["supported", "unsupported"];
const ANSWER_MODES: AnswerMode[] = [
  "fact_check",
  "direct_answer",
  "context_answer_with_news",
];
const CHECK_TYPES: AnswerCheckType[] = [
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
  "check_specific",
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
  queries: OpenAiSearchPlanQueryPayload[];
}

interface OpenAiQueryRefinementPayload {
  coreCheck: string;
  normalizedCheck: string;
  checkType: AnswerCheckType;
  answerMode: AnswerMode;
  searchPlan: OpenAiSearchPlanPayload;
  searchRoute: SearchRoute;
}

interface OpenAiRequestOptions {
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  textVerbosity?: "low" | "medium" | "high";
  maxOutputTokens?: number;
}

interface OpenAiEvidenceSignalDecision {
  sourceId: string;
  stanceToCheck: EvidenceSignalStance;
  temporalRole: EvidenceSignalTemporalRole;
  updateType: EvidenceSignalUpdateType;
  currentAnswerImpact: EvidenceSignalImpact;
  reason: string;
}

interface OpenAiEvidenceSignalPayload {
  signals: OpenAiEvidenceSignalDecision[];
}

interface OpenAiRelevanceSignalDecision {
  candidateId: string;
  relevanceTier: AnswerRelevanceTier;
  relevanceReason: string;
  stanceToCheck: EvidenceSignalStance;
  temporalRole: EvidenceSignalTemporalRole;
  updateType: EvidenceSignalUpdateType;
  currentAnswerImpact: EvidenceSignalImpact;
}

interface OpenAiRelevanceSignalPayload {
  decisions: OpenAiRelevanceSignalDecision[];
  answerSummary: AnswerGeneratedSummary;
}

@Injectable()
export class AnswersOpenAiClient {
  private readonly logger = new Logger(AnswersOpenAiClient.name);

  async answerDirectly(
    apiKey: string,
    coreCheck: string,
  ): Promise<{ answerText: string; citations: { url: string }[] }> {
    const currentDate = new Date().toISOString().slice(0, 10);
    const payload = await this.requestStructuredOutput<{ answer: string }>(
      apiKey,
      {
        name: "direct_answer",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["answer"],
          properties: {
            answer: { type: "string" },
          },
        },
      },
      [
        {
          role: "system",
          content: `한국 정치·경제 관련 사실 정보를 정확하고 간결하게 답변하세요.
현재 날짜: ${currentDate}
공식 정부 발표, 법령, 통계청·한국은행 등 공신력 있는 기관 자료를 기준으로 답변하세요.
기준 날짜나 연도를 반드시 명시하고, 3문장 이내로 핵심만 답변하세요.`,
        },
        {
          role: "user",
          content: coreCheck,
        },
      ],
      "직접 답변 요청에 실패했습니다.",
      { reasoningEffort: "minimal", textVerbosity: "low", maxOutputTokens: 300 },
    );

    return {
      answerText: this.normalizeText(payload.answer, "답변을 생성하지 못했습니다."),
      citations: [],
    };
  }

  async refineQuery(
    apiKey: string,
    rawCheck: string,
  ): Promise<QueryRefinementResult> {
    const currentDate = new Date().toISOString().slice(0, 10);
    const payload =
      await this.requestStructuredOutput<OpenAiQueryRefinementPayload>(
        apiKey,
        {
          name: "answer_query_refinement",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "coreCheck",
              "normalizedCheck",
              "checkType",
              "answerMode",
              "searchRoute",
              "searchPlan",
            ],
            properties: {
              coreCheck: { type: "string" },
              normalizedCheck: { type: "string" },
              checkType: {
                type: "string",
                enum: CHECK_TYPES,
              },
              answerMode: {
                type: "string",
                enum: ANSWER_MODES,
              },
              searchRoute: {
                type: "string",
                enum: SEARCH_ROUTES,
              },
              searchPlan: {
                type: "object",
                additionalProperties: false,
                required: [
                  "queries",
                ],
                properties: {
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
            },
          },
        },
        [
          {
            role: "system",
            content: `팩트체크 대상 주장을 분석해 JSON으로 반환하세요.
현재 날짜: ${currentDate}

## 필드
- coreCheck: 핵심 주장
- normalizedCheck: 검증 가능한 형태로 정규화한 주장
- checkType: scheduled_event | current_status | statistic | quote | policy | corporate_action | incident | general_fact
- answerMode:
  - fact_check: 한국 정치·경제 뉴스성 check의 사실성 검토
  - direct_answer: 뉴스 검색 없이 답변할 일반 설명·상담·창작·범위 밖 질문
  - context_answer_with_news: 한국 정치·경제 이슈의 배경·쟁점·이유를 묻는 설명형 질문
- searchRoute:
  - supported: 한국 정치·경제 뉴스성 check — 뉴스 검색이 필요한 이슈, 루머, 사건, 인물 발언, 정책 변화
  - unsupported: 한국 관련 없음, 해외/글로벌 뉴스, 의료·연예·스포츠·투자 추천, 또는 출처 기반 사실성 검토 대상이 아닌 의견·상담·창작·일반 설명·미래 예측
- route는 인물/기업의 국적보다 check이 다루는 사건·제도·영향의 관할, 장소, 시장을 우선해 판정.
- 한국의 선거, 공직, 국회, 정부, 지자체, 법·정책, 규제, 기업 활동, 금융·부동산·소비자 시장에 관한 사실성 check이면 supported.
- 최종 searchRoute 보정은 서버가 answerMode 기준으로 처리합니다.
- answerMode=direct_answer이면 searchPlan은 빈 배열로 둡니다.

## searchPlan.queries
supported면 정확히 4개, unsupported면 빈 배열.

네이버 뉴스 검색 쿼리 원칙:
- 기사 제목에 실제로 등장할 법한 핵심 키워드 조합
- 인물명·직책·기관명·기업명은 한국어로 정확히 (예: "이재명 대표", "삼성전자", "기획재정부")
- 쿼리 1개는 10~20자, 조사·접속어 최소화
- 4개 쿼리 간 핵심 키워드 중복 최소화
- purpose별:
  - check_specific: 고유명사 + 핵심 행위
  - current_state: 현재 시점 키워드 포함
  - primary_source: "공식"·"발표"·"공시" 등 포함
  - contradiction_or_update: "취소"·"번복"·"정정"·"부인" 등 포함`
          },
          {
            role: "user",
            content: rawCheck,
          },
        ],
        "질의 정제 요청에 실패했습니다.",
        {
          reasoningEffort: "minimal",
          textVerbosity: "low",
          maxOutputTokens: QUERY_REFINEMENT_MAX_OUTPUT_TOKENS,
        },
      );

    const coreCheck = this.normalizeText(payload.coreCheck, rawCheck);
    const normalizedCheck = this.normalizeText(payload.normalizedCheck, coreCheck);
    const checkType = CHECK_TYPES.includes(payload.checkType)
      ? payload.checkType
      : "general_fact";
    const answerMode = ANSWER_MODES.includes(payload.answerMode)
      ? payload.answerMode
      : "direct_answer";
    const rawSearchRoute: SearchRoute =
      payload.searchRoute === "unsupported"
        ? "unsupported"
        : payload.searchRoute === "llm_direct"
          ? "llm_direct"
          : "supported";
    const searchRoute: SearchRoute =
      answerMode === "context_answer_with_news"
        ? "supported"
        : answerMode === "direct_answer"
          ? "unsupported"
          : rawSearchRoute;

    let searchPlan: SearchPlan;
    let generatedQueries: QueryArtifact[];

    if (searchRoute === "unsupported" || searchRoute === "llm_direct") {
      searchPlan = {
        queries: [],
      };
      generatedQueries = [{ id: "q1", text: coreCheck, rank: 1 }];
    } else {
      searchPlan = this.normalizeSearchPlan(payload, {
        normalizedCheck,
        fallbackQueries: [normalizedCheck, coreCheck, rawCheck],
      });
      generatedQueries = this.toSearchQueryArtifacts(searchPlan.queries).slice(0, 3);
    }

    const result: QueryRefinementResult = {
      coreCheck,
      normalizedCheck,
      checkType,
      answerMode,
      searchPlan,
      generatedQueries,
      searchRoute,
      searchRouteReason: "",
    };

    return result;
  }

  async classifyRelevanceAndEvidenceSignals(
    apiKey: string,
    input: RelevanceSignalClassificationInput,
  ): Promise<RelevanceSignalClassificationResult> {
    if (input.candidates.length === 0) {
      return { relevanceCandidates: [], evidenceSignals: [] };
    }

    const payload =
      await this.requestStructuredOutput<OpenAiRelevanceSignalPayload>(
        apiKey,
        {
          name: "answer_relevance_and_evidence_signal",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["decisions", "answerSummary"],
            properties: {
              decisions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "candidateId",
                    "relevanceTier",
                    "relevanceReason",
                    "stanceToCheck",
                    "temporalRole",
                    "updateType",
                    "currentAnswerImpact",
                  ],
                  properties: {
                    candidateId: { type: "string" },
                    relevanceTier: {
                      type: "string",
                      enum: ["primary", "reference", "discard"],
                    },
                    relevanceReason: { type: "string" },
                    stanceToCheck: {
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
                  },
                },
              },
              answerSummary: {
                type: "object",
                additionalProperties: false,
                required: [
                  "analysisSummary",
                  "uncertaintySummary",
                  "uncertaintyItems",
                ],
                properties: {
                  analysisSummary: { type: "string" },
                  uncertaintySummary: { type: "string" },
                  uncertaintyItems: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
        [
          {
            role: "system",
            content: `뉴스 소스의 관련성(relevanceTier), 증거 신호(Evidence Signal), 결과 화면용 summary를 생성하세요.

1. Relevance: primary(직접 근거), reference(보조), discard(무관) 중 선택. 사유는 60자 이내.
2. Signal: core check에 대한 stance(지지/반박 등), 시점 역할(예정/현황/최신), 업데이트 유형, 임팩트를 판정합니다.
3. Summary:
   - analysisSummary는 한국어 2~4문장으로 작성하세요.
   - 수집된 제목/스니펫/source metadata에 근거한 해석만 쓰고, 원문에 없는 사실이나 출처는 만들지 마세요.
   - 절대적 진실 판정처럼 쓰지 말고 "수집된 출처 기준"의 표현을 유지하세요.
   - uncertaintySummary는 1문장, uncertaintyItems는 구체적인 한계 1~3개로 작성하세요.
4. 규칙:
   - source별 signal에서는 사실 여부 결론을 내리지 말고 '소스의 역할'만 기술하세요.
   - discard인 경우: stance=unknown, temporal=background, update=none, impact=neutral로 설정.
   - scheduled_event: 과거 계획과 현재 최신 상태를 엄격히 구분하고, 취소/연기/정정 신호를 포착하세요.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              coreCheck: input.coreCheck,
              candidates: input.candidates.map((candidate) => ({
                candidateId: candidate.id,
                title: candidate.rawTitle,
                snippet: candidate.rawSnippet,
                publishedAt: candidate.publishedAt,
                queryPurposes: candidate.originQueryPurposes ?? [],
                publisherName: candidate.publisherName,
                sourceType: candidate.sourceType,
              })),
            }),
          },
        ],
        "관련성 및 evidence signal 분류 요청에 실패했습니다.",
        {
          reasoningEffort: "minimal",
          textVerbosity: "low",
          maxOutputTokens: RELEVANCE_SIGNAL_MAX_OUTPUT_TOKENS,
        },
      );

    if (!this.isValidRelevanceSignalPayload(payload, input.candidates)) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "관련성 및 evidence signal 분류 결과가 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    const decisions = new Map(
      payload.decisions.map((decision) => [decision.candidateId, decision]),
    );
    const relevanceCandidates = input.candidates.map((candidate) => {
      const decision = decisions.get(candidate.id);

      return {
        ...candidate,
        relevanceTier: decision?.relevanceTier ?? "discard",
        relevanceReason:
          decision?.relevanceReason ?? "관련성 판정 결과가 누락되었습니다.",
      };
    });
    const evidenceSignals = relevanceCandidates.flatMap((candidate) => {
      const decision = decisions.get(candidate.id);

      if (
        !decision ||
        candidate.relevanceTier === "discard" ||
        !candidate.rawSnippet
      ) {
        return [];
      }

      return [
        {
          sourceId: candidate.id,
          snippetId: null,
          stanceToCheck: decision.stanceToCheck,
          temporalRole: decision.temporalRole,
          updateType: decision.updateType,
          currentAnswerImpact: decision.currentAnswerImpact,
          reason: this.normalizeText(
            decision.relevanceReason,
            "signal 분류 이유가 누락되었습니다.",
          ),
        },
      ];
    });

    return {
      relevanceCandidates,
      evidenceSignals,
      answerSummary: this.normalizeAnswerSummary(payload.answerSummary),
    };
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
          name: "answer_evidence_signal_classification",
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
                    "stanceToCheck",
                    "temporalRole",
                    "updateType",
                    "currentAnswerImpact",
                    "reason",
                  ],
                  properties: {
                    sourceId: { type: "string" },
                    stanceToCheck: {
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
            content: `뉴스 근거의 증거 신호(Evidence Signal)를 구조화하세요.

- 소스가 core check에 대해 수행하는 역할을 stance, temporalRole, updateType, impact로 분류합니다.
- 사실 여부 결론을 내리지 말고, 정보 간의 관계(지지, 반박, 보완 등)만 기술하세요.
- scheduled_event: 과거 예정 사항과 현재의 최신 변경/취소/정정 보도를 엄격히 구분하세요.
- 공식 발표 여부는 sourceType과 제목/스니펫을 기준으로 official_statement로 표시하세요.`,
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                coreCheck: input.coreCheck,
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
      stanceToCheck: signal.stanceToCheck,
      temporalRole: signal.temporalRole,
      updateType: signal.updateType,
      currentAnswerImpact: signal.currentAnswerImpact,
      reason: this.normalizeText(signal.reason, "signal 분류 이유가 누락되었습니다."),
    }));
  }

  private normalizeText(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback.trim();
  }

  private normalizeAnswerSummary(summary: AnswerGeneratedSummary): AnswerGeneratedSummary {
    return {
      analysisSummary: this.normalizeText(
        summary.analysisSummary,
        "수집된 출처 기준으로 검토 결과를 요약하기 어렵습니다.",
      ),
      uncertaintySummary: this.normalizeText(
        summary.uncertaintySummary,
        "추가 정보가 확인되면 해석이 달라질 수 있습니다.",
      ),
      uncertaintyItems: summary.uncertaintyItems
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
        .slice(0, 3),
    };
  }

  private normalizeSearchPlan(
    payload: OpenAiQueryRefinementPayload,
    fallback: {
      normalizedCheck: string;
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
          fallback.normalizedCheck,
        priority: index + 1,
      };
    });

    return {
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

  private async requestStructuredOutput<T>(
    apiKey: string,
    schema: { name: string; schema: Record<string, unknown> },
    input: Array<{ role: "system" | "user"; content: string }>,
    errorMessage: string,
    options: OpenAiRequestOptions = {},
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
            ...(options.textVerbosity ? { verbosity: options.textVerbosity } : {}),
            format: {
              type: "json_schema",
              name: schema.name,
              schema: schema.schema,
              strict: true,
            },
          },
          ...(options.reasoningEffort
            ? { reasoning: { effort: options.reasoningEffort } }
            : {}),
          ...(options.maxOutputTokens
            ? { max_output_tokens: options.maxOutputTokens }
            : {}),
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

  private isValidRelevanceSignalPayload(
    payload: OpenAiRelevanceSignalPayload,
    candidates: SearchCandidate[],
  ): payload is OpenAiRelevanceSignalPayload {
    if (
      !payload ||
      !Array.isArray(payload.decisions) ||
      !this.isValidAnswerSummary(payload.answerSummary)
    ) {
      return false;
    }

    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const seenIds = new Set<string>();

    for (const decision of payload.decisions) {
      if (
        !decision ||
        typeof decision.candidateId !== "string" ||
        typeof decision.relevanceReason !== "string" ||
        !["primary", "reference", "discard"].includes(decision.relevanceTier) ||
        !EVIDENCE_SIGNAL_STANCES.includes(decision.stanceToCheck) ||
        !EVIDENCE_SIGNAL_TEMPORAL_ROLES.includes(decision.temporalRole) ||
        !EVIDENCE_SIGNAL_UPDATE_TYPES.includes(decision.updateType) ||
        !EVIDENCE_SIGNAL_IMPACTS.includes(decision.currentAnswerImpact)
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

  private isValidAnswerSummary(value: unknown): value is AnswerGeneratedSummary {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const summary = value as Record<string, unknown>;

    return (
      typeof summary.analysisSummary === "string" &&
      typeof summary.uncertaintySummary === "string" &&
      Array.isArray(summary.uncertaintyItems) &&
      summary.uncertaintyItems.every((item) => typeof item === "string")
    );
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
        !EVIDENCE_SIGNAL_STANCES.includes(signal.stanceToCheck) ||
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
