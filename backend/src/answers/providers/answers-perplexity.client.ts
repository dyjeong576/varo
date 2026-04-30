import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { DirectAnswerResult } from "../answers.types";
import { postJson } from "./answers-provider-http";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_MODEL = "sonar";
const PERPLEXITY_TIMEOUT_MS = 30000;

interface PerplexityResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  citations?: string[];
}

@Injectable()
export class AnswersPerplexityClient {
  private readonly logger = new Logger(AnswersPerplexityClient.name);

  async answerDirectly(
    apiKey: string,
    coreCheck: string,
  ): Promise<DirectAnswerResult> {
    this.logger.log(`perplexity direct answer request; check="${coreCheck.slice(0, 60)}"`);

    const response = await postJson<PerplexityResponse>(
      PERPLEXITY_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: PERPLEXITY_MODEL,
          messages: [
            {
              role: "system",
              content: `한국 정치·경제 관련 사실 정보를 정확하고 간결하게 답변하세요.
공식 정부 발표, 법령, 통계청·한국은행 등 공신력 있는 기관 자료를 우선 인용하세요.
최신 정보를 기준으로 답변하되, 기준 날짜나 연도를 반드시 명시하세요.
3문장 이내로 핵심만 답변하세요.`,
            },
            {
              role: "user",
              content: coreCheck,
            },
          ],
        }),
      },
      PERPLEXITY_TIMEOUT_MS,
      APP_ERROR_CODES.INTERNAL_ERROR,
      "Perplexity 직접 답변 요청에 실패했습니다.",
    );

    const content = response?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      throw new AppException(
        APP_ERROR_CODES.LLM_SCHEMA_ERROR,
        "Perplexity 응답에서 답변 텍스트를 찾지 못했습니다.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    const citations = (response?.citations ?? []).map((url) => ({ url }));

    this.logger.log(
      `perplexity direct answer completed; citations=${citations.length}`,
    );

    return {
      answerText: content.trim(),
      citations,
    };
  }
}
