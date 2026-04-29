import { HttpStatus, Injectable } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { CreateReviewQueryProcessingPreviewDto } from "./dto/create-review-query-processing-preview.dto";
import {
  NaverNewsSearchTestRequestDto,
  NaverNewsSearchTestResponseDto,
} from "./dto/naver-news-search-test.dto";
import { CreateReviewReopenDto } from "./dto/create-review-reopen.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "./dto/review-query-processing-preview-response.dto";
import { ReviewReopenResponseDto } from "./dto/review-reopen-response.dto";
import { ReviewPreviewSummaryResponseDto } from "./dto/review-preview-summary-response.dto";
import { ReviewsQueryPreviewService } from "./query-preview/reviews-query-preview.service";
import { ReviewsProvidersService } from "./reviews.providers.service";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly queryPreviewService: ReviewsQueryPreviewService,
    private readonly providersService: ReviewsProvidersService,
  ) {}

  async createQueryProcessingPreview(
    userId: string,
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.createQueryProcessingPreview(userId, payload);
  }

  async createQueryProcessingPreviewAsync(
    userId: string,
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.createQueryProcessingPreviewAsync(
      userId,
      payload,
    );
  }

  async createTestQueryProcessingPreview(
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
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
        sourceCountryCode: candidate.sourceCountryCode,
        retrievalBucket: candidate.retrievalBucket,
        domainRegistryMatched: false,
        stance: "unknown",
      })),
    };
  }

  async listQueryProcessingPreviews(
    userId: string,
  ): Promise<ReviewPreviewSummaryResponseDto[]> {
    return this.queryPreviewService.listQueryProcessingPreviews(userId);
  }

  async getQueryProcessingPreview(
    userId: string,
    reviewId: string,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.getQueryProcessingPreview(userId, reviewId);
  }

  async deleteQueryProcessingPreview(
    userId: string,
    reviewId: string,
  ): Promise<ReviewReopenResponseDto> {
    await this.queryPreviewService.deleteQueryProcessingPreview(userId, reviewId);

    return { ok: true };
  }

  async recordReviewReopen(
    userId: string,
    reviewId: string,
    _payload: CreateReviewReopenDto,
  ): Promise<ReviewReopenResponseDto> {
    await this.queryPreviewService.recordReviewReopen(userId, reviewId);

    return { ok: true };
  }
}
