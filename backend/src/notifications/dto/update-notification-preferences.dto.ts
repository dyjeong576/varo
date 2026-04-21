import { PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { NotificationPreferencesResponseDto } from "./notification-preferences-response.dto";

export class UpdateNotificationPreferencesDto extends PartialType(
  NotificationPreferencesResponseDto,
) {
  @ApiPropertyOptional({ description: "review 완료 알림 수신 여부", example: true })
  @IsOptional()
  @IsBoolean()
  override reviewCompleted?: boolean;

  @ApiPropertyOptional({ description: "커뮤니티 댓글 알림 수신 여부", example: true })
  @IsOptional()
  @IsBoolean()
  override communityComment?: boolean;

  @ApiPropertyOptional({ description: "커뮤니티 좋아요 알림 수신 여부", example: true })
  @IsOptional()
  @IsBoolean()
  override communityLike?: boolean;
}
