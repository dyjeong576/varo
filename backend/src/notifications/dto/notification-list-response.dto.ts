import { ApiProperty } from "@nestjs/swagger";
import { NotificationItemResponseDto } from "./notification-item-response.dto";

export class NotificationListResponseDto {
  @ApiProperty({
    description: "최근 알림 목록",
    type: NotificationItemResponseDto,
    isArray: true,
  })
  items!: NotificationItemResponseDto[];

  @ApiProperty({ description: "읽지 않은 알림 수", example: 3 })
  unreadCount!: number;
}
