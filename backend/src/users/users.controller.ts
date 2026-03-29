import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { ApiErrorResponseDto } from "../shared/dto/api-error-response.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserMeResponseDto } from "./dto/user-me-response.dto";
import { UsersService } from "./users.service";

@ApiTags("사용자 / 프로필")
@ApiCookieAuth("sessionAuth")
@UseGuards(SessionAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({
    summary: "현재 사용자 조회",
    description: "로그인한 사용자의 계정 정보와 프로필 완성 여부를 조회합니다.",
  })
  @ApiOkResponse({
    description: "현재 사용자 조회 성공",
    type: UserMeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async getMe(
    @CurrentUser() current: { user: { id: string } },
  ): Promise<UserMeResponseDto> {
    return this.usersService.getMe(current.user.id);
  }

  @Patch("me/profile")
  @ApiOperation({
    summary: "현재 사용자 프로필 수정",
    description:
      "첫 로그인 시에는 이름, 성별, 나이대, 국가, 도시를 모두 입력해야 하며 이후에는 국가와 도시만 수정할 수 있습니다.",
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({
    description: "프로필 저장 성공",
    type: UserMeResponseDto,
  })
  @ApiForbiddenResponse({
    description: "수정할 수 없는 필드를 변경하려는 경우",
    type: ApiErrorResponseDto,
  })
  async updateMyProfile(
    @CurrentUser() current: { user: { id: string } },
    @Body() payload: UpdateProfileDto,
  ): Promise<UserMeResponseDto> {
    return this.usersService.updateProfile(current.user.id, payload);
  }
}
