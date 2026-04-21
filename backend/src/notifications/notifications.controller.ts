import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { ApiErrorResponseDto } from "../shared/dto/api-error-response.dto";
import { NotificationActionResponseDto } from "./dto/notification-action-response.dto";
import { NotificationListResponseDto } from "./dto/notification-list-response.dto";
import { NotificationPreferencesResponseDto } from "./dto/notification-preferences-response.dto";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("알림")
@ApiCookieAuth("sessionAuth")
@UseGuards(SessionAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: "알림 목록 조회",
    description: "현재 로그인 사용자의 최근 알림 목록과 unread count를 반환합니다.",
  })
  @ApiOkResponse({
    description: "알림 목록 조회 성공",
    type: NotificationListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async listNotifications(
    @CurrentUser() current: { user: { id: string } },
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.listNotifications(current.user.id);
  }

  @Get("preferences")
  @ApiOperation({
    summary: "알림 설정 조회",
    description: "현재 로그인 사용자의 알림 수신 설정을 반환합니다.",
  })
  @ApiOkResponse({
    description: "알림 설정 조회 성공",
    type: NotificationPreferencesResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async getPreferences(
    @CurrentUser() current: { user: { id: string } },
  ): Promise<NotificationPreferencesResponseDto> {
    return this.notificationsService.getPreferences(current.user.id);
  }

  @Patch("preferences")
  @ApiOperation({
    summary: "알림 설정 수정",
    description: "현재 로그인 사용자의 알림 수신 설정을 수정합니다.",
  })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @ApiOkResponse({
    description: "알림 설정 수정 성공",
    type: NotificationPreferencesResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async updatePreferences(
    @CurrentUser() current: { user: { id: string } },
    @Body() payload: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponseDto> {
    return this.notificationsService.updatePreferences(current.user.id, payload);
  }

  @Post("read-all")
  @ApiOperation({
    summary: "알림 전체 읽음 처리",
    description: "현재 로그인 사용자의 알림을 모두 읽음 처리합니다.",
  })
  @ApiOkResponse({
    description: "알림 전체 읽음 처리 성공",
    type: NotificationActionResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async markAllRead(
    @CurrentUser() current: { user: { id: string } },
  ): Promise<NotificationActionResponseDto> {
    return this.notificationsService.markAllRead(current.user.id);
  }

  @Post(":notificationId/read")
  @ApiOperation({
    summary: "알림 읽음 처리",
    description: "특정 알림을 읽음 처리합니다.",
  })
  @ApiOkResponse({
    description: "알림 읽음 처리 성공",
    type: NotificationActionResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 알림을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async markRead(
    @CurrentUser() current: { user: { id: string } },
    @Param("notificationId") notificationId: string,
  ): Promise<NotificationActionResponseDto> {
    return this.notificationsService.markRead(current.user.id, notificationId);
  }
}
