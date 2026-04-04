import { ApiProperty } from "@nestjs/swagger";

export class CommunityPostLikeResponseDto {
  @ApiProperty({ description: "현재 사용자의 공감 여부", example: true })
  likedByMe!: boolean;

  @ApiProperty({ description: "게시글 총 공감 수", example: 3 })
  likeCount!: number;
}
