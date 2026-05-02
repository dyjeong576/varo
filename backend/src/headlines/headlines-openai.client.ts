import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { postJson } from "../answers/providers/answers-provider-http";
import {
  HeadlineAnalysisClusterInput,
  HeadlineAnalysisPayload,
} from "./headlines.types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";

const HEADLINE_ANALYSIS_SCHEMA = {
  name: "headline_event_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "clusters"],
    properties: {
      summary: { type: "string" },
      clusters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["eventName", "eventSummary", "commonFacts", "uncertainty", "items"],
          properties: {
            eventName: { type: "string" },
            eventSummary: { type: "string" },
            commonFacts: {
              type: "array",
              items: { type: "string" },
            },
            uncertainty: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["articleId", "expressionSummary", "emphasis", "framing"],
                properties: {
                  articleId: { type: "string" },
                  expressionSummary: { type: "string" },
                  emphasis: {
                    anyOf: [{ type: "string" }, { type: "null" }],
                  },
                  framing: {
                    anyOf: [{ type: "string" }, { type: "null" }],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const ANALYSIS_SYSTEM_RULES = `규칙:
- 입력으로 제공된 RSS 제목과 매체명만 사용하세요.
- 기사 본문을 읽었다고 가정하지 마세요.
- 사실 판정, 매체 신뢰도 점수, 정치 성향 판단을 하지 마세요.
- summary는 사용자에게 바로 보여줄 최종 화면 문구입니다.
- summary 첫 문장은 분석 방식이 아니라 오늘 헤드라인에서 보이는 주요 흐름이나 주요 사건으로 시작하세요.
- summary는 2~3문장의 개요 문단 뒤에 빈 줄을 두고, "- "로 시작하는 핵심 bullet 3~5개를 포함하세요.
- summary bullet은 반복 노출된 주요 이슈, 사건 간 흐름, 매체별 표현 차이, 남은 불확실성을 다루세요.
- 입력 clusters는 RSS 제목만으로 1차 군집화된 후보입니다. 각 입력 cluster를 기준으로 사건명과 표현 차이만 다듬으세요.
- 모든 입력 article은 빠짐없이 정확히 하나의 cluster.items에 포함하세요. 단 하나의 articleId도 누락하지 마세요.
- cluster는 서로 다른 publisherKey 수가 많은 사건 순으로 정렬하고, 같은 매체의 복수 기사도 모두 items에 포함하세요.
- 입력 수와 무관하게 반드시 전체 입력을 처리하세요. 사용자에게 진행 여부, 우선순위 지정, 범위 축소를 요청하는 것은 엄격히 금지됩니다.
- summary와 어떤 필드에도 작업 가능 여부, 시간 부족, 분량 초과, 범위 축소 요청 같은 메타 설명을 절대 쓰지 마세요.
- summary에는 데이터 처리 과정, 분류 방식, 정렬 기준, 모델이 수행한 작업, 출력 형식에 대한 설명을 쓰지 마세요.
- expressionSummary는 각 매체가 제목에서 사건을 어떻게 표현했는지 짧게 설명하세요.`;

@Injectable()
export class HeadlinesOpenAiClient {
  private readonly logger = new Logger(HeadlinesOpenAiClient.name);

  async analyzeHeadlines(
    apiKey: string,
    dateKey: string,
    category: "politics" | "economy",
    clusters: HeadlineAnalysisClusterInput[],
  ): Promise<HeadlineAnalysisPayload> {
    const startedAt = Date.now();
    let payload: HeadlineAnalysisPayload;
    const articleCount = clusters.reduce((sum, cluster) => sum + cluster.articles.length, 0);

    try {
      payload = await this.requestAnalysis(apiKey, dateKey, category, clusters);
      this.logger.log(`headline openai analysis completed; dateKey=${dateKey}; category=${category}; articleCount=${articleCount}; inputClusterCount=${clusters.length}; clusterCount=${payload.clusters?.length ?? 0}; elapsedMs=${Date.now() - startedAt}`);
    } catch (error) {
      const details = error instanceof AppException && error.details
        ? `; details=${JSON.stringify(error.details)}`
        : "";

      this.logger.warn(`headline openai analysis failed; dateKey=${dateKey}; category=${category}; articleCount=${articleCount}; inputClusterCount=${clusters.length}; elapsedMs=${Date.now() - startedAt}; error=${error instanceof Error ? error.message : "unknown"}${details}`);
      throw error;
    }

    if (!payload || !Array.isArray(payload.clusters) || typeof payload.summary !== "string") {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "헤드라인 분석 응답이 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      summary: this.normalizeSummary(payload.summary),
      clusters: payload.clusters.map((cluster) => ({
        eventName: this.normalizeText(cluster.eventName, "분류되지 않은 사건"),
        eventSummary: this.normalizeText(cluster.eventSummary, "수집된 헤드라인 기준 사건 요약입니다."),
        commonFacts: Array.isArray(cluster.commonFacts)
          ? cluster.commonFacts.filter((item) => typeof item === "string" && item.trim()).slice(0, 4)
          : [],
        uncertainty: typeof cluster.uncertainty === "string" && cluster.uncertainty.trim()
          ? cluster.uncertainty.trim()
          : null,
        items: Array.isArray(cluster.items)
          ? cluster.items.map((item) => ({
              articleId: this.normalizeText(item.articleId, ""),
              expressionSummary: this.normalizeText(item.expressionSummary, "표현 요약이 없습니다."),
              emphasis: typeof item.emphasis === "string" && item.emphasis.trim() ? item.emphasis.trim() : null,
              framing: typeof item.framing === "string" && item.framing.trim() ? item.framing.trim() : null,
            }))
          : [],
      })),
    };
  }

  private async requestAnalysis(
    apiKey: string,
    dateKey: string,
    category: "politics" | "economy",
    clusters: HeadlineAnalysisClusterInput[],
  ): Promise<HeadlineAnalysisPayload> {
    return this.requestStructuredOutput<HeadlineAnalysisPayload>(
      apiKey,
      HEADLINE_ANALYSIS_SCHEMA,
      [
        {
          role: "system",
          content: `한국어 뉴스 RSS 헤드라인의 로컬 사건 묶음 후보를 다듬어 비교하세요.
현재 날짜: ${dateKey}
분석 카테고리: ${category === "politics" ? "정치" : "경제"}

${ANALYSIS_SYSTEM_RULES}`,
        },
        {
          role: "user",
          content: JSON.stringify({ dateKey, category, clusters }, null, 2),
        },
      ],
      16000,
    );
  }

  private async requestStructuredOutput<T>(
    apiKey: string,
    schema: { name: string; schema: Record<string, unknown> },
    input: Array<{ role: "system" | "user"; content: string }>,
    maxOutputTokens = 16000,
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
            verbosity: "medium",
            format: {
              type: "json_schema",
              name: schema.name,
              schema: schema.schema,
              strict: true,
            },
          },
          reasoning: { effort: "low" },
          max_output_tokens: maxOutputTokens,
        }),
      },
      null,
      APP_ERROR_CODES.INTERNAL_ERROR,
      "헤드라인 분석 요청에 실패했습니다.",
    );

    return this.parseStructuredOutput<T>(response);
  }

  private parseStructuredOutput<T>(response: unknown): T {
    const outputText = this.extractOutputText(response);

    try {
      return JSON.parse(outputText) as T;
    } catch {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "헤드라인 분석 응답이 유효한 JSON이 아닙니다.",
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
      const content = item && typeof item === "object"
        ? (item as { content?: unknown }).content
        : null;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const part of content) {
        const text = part && typeof part === "object"
          ? (part as { text?: unknown }).text
          : null;

        if (typeof text === "string" && text.trim()) {
          return text;
        }
      }
    }

    throw new AppException(
      APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      "OpenAI 응답에서 구조화된 텍스트를 찾지 못했습니다.",
      HttpStatus.BAD_GATEWAY,
    );
  }

  private normalizeText(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  private normalizeSummary(value: unknown): string {
    const summary = this.normalizeText(value, "수집된 헤드라인 기준으로 사건 표현을 비교했습니다.");
    const invalidPhrases = [
      "계속 진행",
      "범위를 좁",
      "우선순위",
      "시간이 더 필요",
      "가능하면",
      "원하시면",
      "추가 시간",
      "지정해 주시면",
      "분량",
      "한 번에",
      "기준에 맞춰",
      "입력량",
      "처리하겠습니다",
    ];

    if (invalidPhrases.some((phrase) => summary.includes(phrase))) {
      return [
        "오늘 수집된 헤드라인은 여러 주요 현안이 동시에 부각된 흐름입니다.",
        "",
        "- 여러 매체가 반복해서 다룬 이슈를 중심으로 정리했습니다.",
        "- 제목에서 드러나는 표현과 강조 차이를 함께 표시했습니다.",
        "- 세부 사실관계와 맥락은 원문 확인이 필요한 불확실성으로 남습니다.",
      ].join("\n");
    }

    return summary;
  }
}
