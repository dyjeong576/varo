import { ApiProperty } from "@nestjs/swagger";

export class NotificationPreferencesResponseDto {
  @ApiProperty({ description: "answer 완료 알림 수신 여부", example: true })
  answerCompleted!: boolean;

  @ApiProperty({ description: "커뮤니티 댓글 알림 수신 여부", example: true })
  communityComment!: boolean;

  @ApiProperty({ description: "커뮤니티 좋아요 알림 수신 여부", example: true })
  communityLike!: boolean;
}
