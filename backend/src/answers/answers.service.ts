import { HttpStatus, Injectable } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { CreateAnswerQueryProcessingPreviewDto } from "./dto/create-answer-query-processing-preview.dto";
import {
  NaverNewsSearchTestRequestDto,
  NaverNewsSearchTestResponseDto,
} from "./dto/naver-news-search-test.dto";
import { CreateAnswerReopenDto } from "./dto/create-answer-reopen.dto";
import { AnswerQueryProcessingPreviewResponseDto } from "./dto/answer-query-processing-preview-response.dto";
import { AnswerReopenResponseDto } from "./dto/answer-reopen-response.dto";
import { AnswerPreviewSummaryResponseDto } from "./dto/answer-preview-summary-response.dto";
import { AnswersQueryPreviewService } from "./query-preview/answers-query-preview.service";
import { AnswersProvidersService } from "./answers.providers.service";

@Injectable()
export class AnswersService {
  constructor(
    private readonly queryPreviewService: AnswersQueryPreviewService,
    private readonly providersService: AnswersProvidersService,
  ) {}

  async createQueryProcessingPreview(
    userId: string,
    payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.createQueryProcessingPreview(userId, payload);
  }

  async createQueryProcessingPreviewAsync(
    userId: string,
    payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.createQueryProcessingPreviewAsync(
      userId,
      payload,
    );
  }

  async createTestQueryProcessingPreview(
    payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.createTestQueryProcessingPreview(payload);
  }

  async searchNaverNewsForTest(
    payload: NaverNewsSearchTestRequestDto,
  ): Promise<NaverNewsSearchTestResponseDto> {
    const query = payload.query.trim();

    if (!query) {
      throw new AppException(
        APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
        "검색할 query를 입력해 주세요.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const display = payload.display ?? 5;
    const start = payload.start ?? 1;
    const sort = payload.sort ?? "sim";
    const candidates = await this.providersService.searchNaverNewsForTest({
      query,
      display,
      start,
      sort,
    });

    return {
      query,
      display,
      start,
      sort,
      items: candidates.map((candidate) => ({
        id: candidate.id,
        sourceType: candidate.sourceType,
        publisherName: candidate.publisherName,
        canonicalUrl: candidate.canonicalUrl,
        originalUrl: candidate.originalUrl,
        publishedAt: candidate.publishedAt,
        rawTitle: candidate.rawTitle,
        rawSnippet: candidate.rawSnippet,
        relevanceTier: candidate.relevanceTier ?? "reference",
        relevanceReason:
          candidate.relevanceReason ?? "Naver 뉴스 검색 테스트 결과입니다.",
        originQueryIds: candidate.originQueryIds,
        retrievalBucket: candidate.retrievalBucket,
        domainRegistryMatched: false,
        stance: "unknown",
      })),
    };
  }

  async listQueryProcessingPreviews(
    userId: string,
  ): Promise<AnswerPreviewSummaryResponseDto[]> {
    return this.queryPreviewService.listQueryProcessingPreviews(userId);
  }

  async getQueryProcessingPreview(
    userId: string,
    answerId: string,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.getQueryProcessingPreview(userId, answerId);
  }

  async deleteQueryProcessingPreview(
    userId: string,
    answerId: string,
  ): Promise<AnswerReopenResponseDto> {
    await this.queryPreviewService.deleteQueryProcessingPreview(userId, answerId);

    return { ok: true };
  }

  async recordAnswerReopen(
    userId: string,
    answerId: string,
    _payload: CreateAnswerReopenDto,
  ): Promise<AnswerReopenResponseDto> {
    await this.queryPreviewService.recordAnswerReopen(userId, answerId);

    return { ok: true };
  }
}
