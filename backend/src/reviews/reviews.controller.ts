import { Body, Controller, Get, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AppException } from "../common/exceptions/app-exception";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { ApiErrorResponseDto } from "../shared/dto/api-error-response.dto";
import { CreateReviewQueryProcessingPreviewDto } from "./dto/create-review-query-processing-preview.dto";
import { CreateReviewReopenDto } from "./dto/create-review-reopen.dto";
import { ReviewQueryProcessingPreviewResponseDto } from "./dto/review-query-processing-preview-response.dto";
import { ReviewReopenResponseDto } from "./dto/review-reopen-response.dto";
import { ReviewPreviewSummaryResponseDto } from "./dto/review-preview-summary-response.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("리뷰 / 질의 처리")
@Controller("reviews")
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly configService: ConfigService,
  ) {}

  @Post("query-processing-preview")
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: "review query processing 미리보기 실행",
    description:
      "claim intake부터 evidence preparation 직전 handoff payload 생성까지의 review query pipeline을 실행합니다.",
  })
  @ApiOkResponse({
    description: "질의 처리 미리보기 성공",
    type: ReviewQueryProcessingPreviewResponseDto,
  })
  @ApiBadRequestResponse({
    description: "claim 검증 실패",
    type: ApiErrorResponseDto,
  })
  @ApiBadGatewayResponse({
    description: "외부 provider 처리 실패",
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async createQueryProcessingPreview(
    @CurrentUser() current: { user: { id: string } },
    @Body() payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    return this.reviewsService.createQueryProcessingPreview(current.user.id, payload);
  }

  @Get()
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: "최근 review preview 목록 조회",
    description: "로그인한 사용자의 최근 review query processing preview 목록을 반환합니다.",
  })
  @ApiOkResponse({
    description: "review preview 목록 조회 성공",
    type: ReviewPreviewSummaryResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async listQueryProcessingPreviews(
    @CurrentUser() current: { user: { id: string } },
  ): Promise<ReviewPreviewSummaryResponseDto[]> {
    return this.reviewsService.listQueryProcessingPreviews(current.user.id);
  }

  @Get(":reviewId")
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: "review query processing preview 상세 조회",
    description: "로그인한 사용자가 접근 가능한 review preview 상세와 수집된 evidence/source를 반환합니다.",
  })
  @ApiOkResponse({
    description: "review preview 상세 조회 성공",
    type: ReviewQueryProcessingPreviewResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 review를 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async getQueryProcessingPreview(
    @CurrentUser() current: { user: { id: string } },
    @Param("reviewId") reviewId: string,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    return this.reviewsService.getQueryProcessingPreview(current.user.id, reviewId);
  }

  @Post(":reviewId/reopen")
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: "review preview 재진입 이벤트 기록",
    description:
      "popular, history, notification 재진입 액션에서 review preview reopen 이벤트를 저장합니다.",
  })
  @ApiOkResponse({
    description: "재진입 이벤트 기록 성공",
    type: ReviewReopenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 review를 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async recordReviewReopen(
    @CurrentUser() current: { user: { id: string } },
    @Param("reviewId") reviewId: string,
    @Body() payload: CreateReviewReopenDto,
  ): Promise<ReviewReopenResponseDto> {
    return this.reviewsService.recordReviewReopen(current.user.id, reviewId, payload);
  }

  @Post("query-processing-preview/test")
  @ApiOperation({
    summary: "review query processing 테스트 API",
    description:
      "로컬/개발 환경에서 세션 없이 review query pipeline을 테스트하기 위한 전용 엔드포인트입니다.",
  })
  @ApiOkResponse({
    description: "테스트용 질의 처리 미리보기 성공",
    type: ReviewQueryProcessingPreviewResponseDto,
  })
  @ApiBadRequestResponse({
    description: "claim 검증 실패",
    type: ApiErrorResponseDto,
  })
  @ApiBadGatewayResponse({
    description: "외부 provider 처리 실패",
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "dev 환경이 아니어서 사용할 수 없음",
    type: ApiErrorResponseDto,
  })
  async createTestQueryProcessingPreview(
    @Body() payload: CreateReviewQueryProcessingPreviewDto,
  ): Promise<ReviewQueryProcessingPreviewResponseDto> {
    this.ensureDevOnly();

    return this.reviewsService.createTestQueryProcessingPreview(payload);
  }

  private ensureDevOnly(): void {
    const appEnv =
      this.configService.get<string>("appEnv") ??
      this.configService.get<string>("APP_ENV") ??
      "dev";

    if (appEnv !== "dev") {
      throw new AppException(
        APP_ERROR_CODES.FORBIDDEN,
        "테스트용 review API는 dev 환경에서만 사용할 수 있습니다.",
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
