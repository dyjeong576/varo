import { Controller, Get, Headers, HttpStatus, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { ApiErrorResponseDto } from "../shared/dto/api-error-response.dto";
import {
  HeadlinesAnalysisResponseDto,
  HeadlineScrapeResponseDto,
  HeadlinesTodayResponseDto,
} from "./dto/headlines-response.dto";
import { HeadlinesService } from "./headlines.service";

const HEADLINE_CATEGORY_QUERY = {
  name: "category",
  required: false,
  schema: {
    type: "string",
    enum: ["politics", "economy"],
  },
  description: "조회 또는 수집할 RSS 카테고리입니다. politics는 정치, economy는 경제입니다.",
  example: "economy",
};

@ApiTags("오늘의 헤드라인")
@Controller("headlines")
export class HeadlinesController {
  constructor(
    private readonly headlinesService: HeadlinesService,
    private readonly configService: ConfigService,
  ) {}

  @Get("today")
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth("sessionAuth")
  @ApiOperation({
    summary: "오늘의 헤드라인 조회",
    description: "KST 날짜 기준으로 저장된 매체별 RSS 헤드라인을 반환합니다. category=economy를 전달하면 경제 RSS 헤드라인만 조회합니다.",
  })
  @ApiQuery({ name: "date", required: false, type: String, description: "조회 날짜입니다. YYYY-MM-DD 형식이며 생략하면 KST 오늘 날짜를 사용합니다.", example: "2026-04-30" })
  @ApiQuery(HEADLINE_CATEGORY_QUERY)
  @ApiOkResponse({ type: HeadlinesTodayResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async getToday(
    @Query("date") date?: string,
    @Query("category") category?: string,
  ): Promise<HeadlinesTodayResponseDto> {
    return this.headlinesService.getToday(date, category);
  }

  @Get("live")
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth("sessionAuth")
  @ApiOperation({
    summary: "실시간 헤드라인 조회",
    description: "DB에 저장하지 않고 RSS를 즉시 조회해 매체별 헤드라인을 반환합니다. category=economy를 전달하면 경제 RSS만 즉시 조회합니다.",
  })
  @ApiQuery(HEADLINE_CATEGORY_QUERY)
  @ApiOkResponse({ type: HeadlinesTodayResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async getLive(@Query("category") category?: string): Promise<HeadlinesTodayResponseDto> {
    return this.headlinesService.getLive(category);
  }

  @Get("today/analysis")
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth("sessionAuth")
  @ApiOperation({
    summary: "오늘의 헤드라인 분석 조회",
    description: "수집된 RSS 제목과 요약만 기반으로 사건별 표현 비교 분석을 반환합니다. category=economy를 전달하면 경제 RSS 헤드라인 기반 표현만 반환합니다.",
  })
  @ApiQuery({ name: "date", required: false, type: String, description: "분석 날짜입니다. YYYY-MM-DD 형식이며 생략하면 KST 오늘 날짜를 사용합니다.", example: "2026-04-30" })
  @ApiQuery(HEADLINE_CATEGORY_QUERY)
  @ApiOkResponse({ type: HeadlinesAnalysisResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async getAnalysis(
    @Query("date") date?: string,
    @Query("category") category?: string,
  ): Promise<HeadlinesAnalysisResponseDto> {
    return this.headlinesService.getAnalysis(date, category);
  }

  @Post("internal/scrape")
  @ApiHeader({ name: "x-varo-job-secret", required: true })
  @ApiQuery(HEADLINE_CATEGORY_QUERY)
  @ApiOperation({
    summary: "오늘의 헤드라인 수동 수집",
    description: "운영용 내부 수동 실행 API입니다. HEADLINE_JOB_SECRET과 일치하는 헤더가 필요합니다. category=economy를 전달하면 경제 RSS만 수집합니다.",
  })
  @ApiOkResponse({ type: HeadlineScrapeResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async scrapeManually(
    @Headers("x-varo-job-secret") secret?: string,
    @Query("category") category?: string,
  ): Promise<{ ok: true; dateKey: string; fetchedCount: number; savedCount: number }> {
    const expectedSecret = this.configService.get<string | null>("headlineJobSecret", null);

    if (!expectedSecret || secret !== expectedSecret) {
      throw new AppException(
        APP_ERROR_CODES.FORBIDDEN,
        "헤드라인 수동 수집 권한이 없습니다.",
        HttpStatus.FORBIDDEN,
      );
    }

    const result = await this.headlinesService.scrapeHeadlines("manual", category);

    return { ok: true, ...result };
  }
}
