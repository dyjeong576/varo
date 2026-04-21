import { ApiProperty } from "@nestjs/swagger";

export class NotificationActionResponseDto {
  @ApiProperty({ description: "알림 작업 성공 여부", example: true })
  ok!: true;
}
