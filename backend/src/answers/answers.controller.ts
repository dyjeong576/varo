import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
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
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { AppException } from "../common/exceptions/app-exception";
import { SessionOrGuestActorGuard } from "../common/guards/session-or-guest-actor.guard";
import type { RequestActor } from "../common/types/authenticated-request";
import { ApiErrorResponseDto } from "../shared/dto/api-error-response.dto";
import { CreateAnswerQueryProcessingPreviewDto } from "./dto/create-answer-query-processing-preview.dto";
import { CreateAnswerReopenDto } from "./dto/create-answer-reopen.dto";
import {
  NaverNewsSearchTestRequestDto,
  NaverNewsSearchTestResponseDto,
} from "./dto/naver-news-search-test.dto";
import { AnswerQueryProcessingPreviewResponseDto } from "./dto/answer-query-processing-preview-response.dto";
import { AnswerReopenResponseDto } from "./dto/answer-reopen-response.dto";
import { AnswerPreviewSummaryResponseDto } from "./dto/answer-preview-summary-response.dto";
import { AnswersService } from "./answers.service";

@ApiTags("answer / 질의 처리")
@Controller("answers")
export class AnswersController {
  constructor(
    private readonly answersService: AnswersService,
    private readonly configService: ConfigService,
  ) {}

  @Post("query-processing-preview")
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionOrGuestActorGuard)
  @ApiOperation({
    summary: "answer query processing 미리보기 실행",
    description:
      "check intake부터 evidence preparation 직전 handoff payload 생성까지의 answer query pipeline을 실행하고, 수집된 출처 기준 임시 결과 화면 계약을 함께 반환합니다.",
  })
  @ApiOkResponse({
    description: "질의 처리 미리보기 성공",
    type: AnswerQueryProcessingPreviewResponseDto,
  })
  @ApiBadRequestResponse({
    description: "check 검증 실패",
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
    @CurrentActor() actor: RequestActor,
    @Body() payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    return this.answersService.createQueryProcessingPreview(actor, payload);
  }

  @Post("query-processing-preview/async")
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionOrGuestActorGuard)
  @ApiOperation({
    summary: "answer query processing 비동기 미리보기 실행",
    description:
      "source search가 끝나면 수집된 출처를 먼저 반환하고, relevance/evidence signal 분류는 background에서 이어서 처리합니다.",
  })
  @ApiOkResponse({
    description: "질의 처리 비동기 미리보기 시작 성공",
    type: AnswerQueryProcessingPreviewResponseDto,
  })
  @ApiBadRequestResponse({
    description: "check 검증 실패",
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
  async createQueryProcessingPreviewAsync(
    @CurrentActor() actor: RequestActor,
    @Body() payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    return this.answersService.createQueryProcessingPreviewAsync(
      actor,
      payload,
    );
  }

  @Get()
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionOrGuestActorGuard)
  @ApiOperation({
    summary: "최근 answer preview 목록 조회",
    description: "현재 계정 또는 게스트 브라우저의 최근 answer query processing preview 목록을 반환합니다.",
  })
  @ApiOkResponse({
    description: "answer preview 목록 조회 성공",
    type: AnswerPreviewSummaryResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async listQueryProcessingPreviews(
    @CurrentActor() actor: RequestActor,
  ): Promise<AnswerPreviewSummaryResponseDto[]> {
    return this.answersService.listQueryProcessingPreviews(actor);
  }

  @Get(":answerId")
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionOrGuestActorGuard)
  @ApiOperation({
    summary: "answer query processing preview 상세 조회",
    description:
      "현재 계정 또는 게스트 브라우저가 접근 가능한 answer 상세와 수집된 evidence/source, 그리고 현재 저장된 근거 기준 임시 결과 화면 데이터를 반환합니다.",
  })
  @ApiOkResponse({
    description: "answer preview 상세 조회 성공",
    type: AnswerQueryProcessingPreviewResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 answer를 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async getQueryProcessingPreview(
    @CurrentActor() actor: RequestActor,
    @Param("answerId") answerId: string,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    return this.answersService.getQueryProcessingPreview(actor, answerId);
  }

  @Delete(":answerId")
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionOrGuestActorGuard)
  @ApiOperation({
    summary: "answer preview 삭제",
    description:
      "현재 계정 또는 게스트 브라우저 소유 answer preview와 연결된 source, evidence, history, answer 대상 알림을 함께 삭제합니다.",
  })
  @ApiOkResponse({
    description: "answer preview 삭제 성공",
    type: AnswerReopenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 answer를 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async deleteQueryProcessingPreview(
    @CurrentActor() actor: RequestActor,
    @Param("answerId") answerId: string,
  ): Promise<AnswerReopenResponseDto> {
    return this.answersService.deleteQueryProcessingPreview(actor, answerId);
  }

  @Post(":answerId/reopen")
  @ApiCookieAuth("sessionAuth")
  @UseGuards(SessionOrGuestActorGuard)
  @ApiOperation({
    summary: "answer preview 재진입 이벤트 기록",
    description:
      "popular, history, notification 재진입 액션에서 answer preview reopen 이벤트를 저장합니다.",
  })
  @ApiOkResponse({
    description: "재진입 이벤트 기록 성공",
    type: AnswerReopenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 answer를 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async recordAnswerReopen(
    @CurrentActor() actor: RequestActor,
    @Param("answerId") answerId: string,
    @Body() payload: CreateAnswerReopenDto,
  ): Promise<AnswerReopenResponseDto> {
    return this.answersService.recordAnswerReopen(actor, answerId, payload);
  }

  @Post("query-processing-preview/test")
  @ApiOperation({
    summary: "answer query processing 테스트 API",
    description:
      "로컬/개발 환경에서 세션 없이 answer query pipeline을 테스트하기 위한 전용 엔드포인트입니다.",
  })
  @ApiOkResponse({
    description: "테스트용 질의 처리 미리보기 성공",
    type: AnswerQueryProcessingPreviewResponseDto,
  })
  @ApiBadRequestResponse({
    description: "check 검증 실패",
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
    @Body() payload: CreateAnswerQueryProcessingPreviewDto,
  ): Promise<AnswerQueryProcessingPreviewResponseDto> {
    this.ensureDevOnly();

    return this.answersService.createTestQueryProcessingPreview(payload);
  }

  @Post("naver-news-search/test")
  @ApiOperation({
    summary: "Naver 뉴스 검색 테스트 API",
    description:
      "로컬/개발 환경에서 세션 없이 Naver News Search API client를 직접 테스트하기 위한 전용 엔드포인트입니다. DB에는 저장하지 않습니다.",
  })
  @ApiOkResponse({
    description: "Naver 뉴스 검색 테스트 성공",
    type: NaverNewsSearchTestResponseDto,
  })
  @ApiBadRequestResponse({
    description: "검색 query 검증 실패",
    type: ApiErrorResponseDto,
  })
  @ApiBadGatewayResponse({
    description: "Naver provider 처리 실패",
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "dev 환경이 아니어서 사용할 수 없음",
    type: ApiErrorResponseDto,
  })
  async searchNaverNewsForTest(
    @Body() payload: NaverNewsSearchTestRequestDto,
  ): Promise<NaverNewsSearchTestResponseDto> {
    this.ensureDevOnly();

    return this.answersService.searchNaverNewsForTest(payload);
  }

  private ensureDevOnly(): void {
    const appEnv =
      this.configService.get<string>("appEnv") ??
      this.configService.get<string>("APP_ENV") ??
      "dev";

    if (appEnv !== "dev") {
      throw new AppException(
        APP_ERROR_CODES.FORBIDDEN,
        "테스트용 answer API는 dev 환경에서만 사용할 수 있습니다.",
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
