import { Injectable } from "@nestjs/common";
import { CreateReviewQueryProcessingPreviewDto } from "./dto/create-review-query-processing-preview.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "./dto/review-query-processing-preview-response.dto";
import { ReviewsQueryPreviewService } from "./query-preview/reviews-query-preview.service";

@Injectable()
export class ReviewsService {
  constructor(private readonly queryPreviewService: ReviewsQueryPreviewService) {}

  async createQueryProcessingPreview(
    userId: string,
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.createQueryProcessingPreview(userId, payload);
  }

  async createTestQueryProcessingPreview(
    payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    return this.queryPreviewService.createTestQueryProcessingPreview(payload);
  }
}
