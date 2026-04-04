import { ApiProperty } from "@nestjs/swagger";

export class CommunityCommentLikeResponseDto {
  @ApiProperty({ description: "현재 사용자의 댓글 좋아요 여부", example: true })
  likedByMe!: boolean;

  @ApiProperty({ description: "댓글 총 좋아요 수", example: 4 })
  likeCount!: number;
}
