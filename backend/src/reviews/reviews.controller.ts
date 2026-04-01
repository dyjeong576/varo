import { Body, Controller, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiCookieAuth,
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
import { ReviewQueryProcessingPreviewResponseDto } from "./dto/review-query-processing-preview-response.dto";
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
