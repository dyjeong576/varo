import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { ApiErrorResponseDto } from "../shared/dto/api-error-response.dto";
import { PopularTopicResponseDto } from "./dto/popular-topic-response.dto";
import { PopularService } from "./popular.service";

@ApiTags("인기 주제")
@ApiCookieAuth("sessionAuth")
@UseGuards(SessionAuthGuard)
@Controller("popular/topics")
export class PopularController {
  constructor(private readonly popularService: PopularService) {}

  @Get()
  @ApiOperation({
    summary: "인기 검색 주제 목록 조회",
    description:
      "최근 24시간 내 submitted와 meaningful reopen의 합산 점수가 10 이상인 topic만 대상으로, 인기 점수 기준으로 정렬해 반환합니다.",
  })
  @ApiOkResponse({
    description: "인기 검색 주제 목록 조회 성공",
    type: PopularTopicResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async listTopics(): Promise<PopularTopicResponseDto[]> {
    return this.popularService.listTopics();
  }
}
