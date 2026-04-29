import { ApiProperty } from "@nestjs/swagger";

export const NOTIFICATION_RESPONSE_TYPES = [
  "answer_completed",
  "community_comment",
  "community_like",
] as const;

export const NOTIFICATION_TARGET_TYPES = ["answer", "community_post"] as const;

export class NotificationItemResponseDto {
  @ApiProperty({ description: "알림 식별자", example: "notification-1" })
  id!: string;

  @ApiProperty({
    description: "알림 종류",
    enum: NOTIFICATION_RESPONSE_TYPES,
    example: "answer_completed",
  })
  type!: (typeof NOTIFICATION_RESPONSE_TYPES)[number];

  @ApiProperty({ description: "알림 제목", example: "근거 수집 완료" })
  title!: string;

  @ApiProperty({
    description: "알림 본문",
    example: "\"전기차 보조금 축소\" 검토가 완료되었습니다.",
  })
  message!: string;

  @ApiProperty({ description: "읽음 여부", example: false })
  isRead!: boolean;

  @ApiProperty({
    description: "알림 생성 시각",
    example: "2026-04-19T10:00:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "알림 이동 대상 종류",
    enum: NOTIFICATION_TARGET_TYPES,
    example: "answer",
  })
  targetType!: (typeof NOTIFICATION_TARGET_TYPES)[number];

  @ApiProperty({
    description: "알림 이동 대상 식별자",
    example: "answer-1",
  })
  targetId!: string;
}
