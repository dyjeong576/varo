import { HttpStatus, Injectable } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { postJson } from "../answers/providers/answers-provider-http";
import {
  HeadlineAnalysisArticleInput,
  HeadlineAnalysisPayload,
} from "./headlines.types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_TIMEOUT_MS = 300000;

@Injectable()
export class HeadlinesOpenAiClient {
  async analyzeHeadlines(
    apiKey: string,
    dateKey: string,
    category: "politics" | "economy",
    articles: HeadlineAnalysisArticleInput[],
  ): Promise<HeadlineAnalysisPayload> {
    const payload = await this.requestStructuredOutput<HeadlineAnalysisPayload>(
      apiKey,
      {
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
      },
      [
        {
          role: "system",
          content: `한국어 뉴스 RSS 헤드라인을 사건별로 묶어 비교하세요.
현재 날짜: ${dateKey}
분석 카테고리: ${category === "politics" ? "정치" : "경제"}

규칙:
- 입력으로 제공된 RSS 제목, 요약, 매체명만 사용하세요.
- 기사 본문을 읽었다고 가정하지 마세요.
- 사실 판정, 매체 신뢰도 점수, 정치 성향 판단을 하지 마세요.
- summary는 2~3문장의 개요 문단 뒤에 빈 줄을 두고, "- "로 시작하는 핵심 bullet 3~5개를 포함하세요.
- summary bullet은 주요 사건 흐름, 반복 노출된 이슈, 매체별 표현 차이, 남은 불확실성을 다루세요.
- 같은 사건을 다루는 기사만 하나의 cluster로 묶고, 근거가 약하면 uncertainty에 명시하세요.
- expressionSummary는 각 매체가 제목/요약에서 사건을 어떻게 표현했는지 짧게 설명하세요.`,
        },
        {
          role: "user",
          content: JSON.stringify({ dateKey, category, articles }, null, 2),
        },
      ],
    );

    if (!payload || !Array.isArray(payload.clusters) || typeof payload.summary !== "string") {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "헤드라인 분석 응답이 요구 형식을 충족하지 않습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      summary: this.normalizeText(payload.summary, "수집된 헤드라인 기준으로 사건 표현을 비교했습니다."),
      clusters: payload.clusters.slice(0, 12).map((cluster) => ({
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

  private async requestStructuredOutput<T>(
    apiKey: string,
    schema: { name: string; schema: Record<string, unknown> },
    input: Array<{ role: "system" | "user"; content: string }>,
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
          max_output_tokens: 6000,
        }),
      },
      OPENAI_TIMEOUT_MS,
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
}
