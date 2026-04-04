import { ApiProperty } from "@nestjs/swagger";
import { CommunityAuthorResponseDto } from "./community-author-response.dto";

export class CommunityCommentResponseDto {
  @ApiProperty({ description: "댓글 식별자", example: "comment-1" })
  id!: string;

  @ApiProperty({ description: "댓글이 속한 게시글 식별자", example: "post-1" })
  postId!: string;

  @ApiProperty({ description: "댓글 작성자", type: CommunityAuthorResponseDto })
  author!: CommunityAuthorResponseDto;

  @ApiProperty({
    description: "상위 댓글 식별자. 루트 댓글이면 null",
    example: null,
    nullable: true,
  })
  parentCommentId!: string | null;

  @ApiProperty({
    description: "댓글 본문",
    example: "보도 자료를 보면 배터리 제조사만 강조하고 실제 관리 부실에 대한 언급은 적은 것 같아요.",
  })
  content!: string;

  @ApiProperty({
    description: "댓글 작성 시각",
    example: "2026-04-02T03:30:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({ description: "현재 사용자가 작성한 댓글인지 여부", example: true })
  isAuthor!: boolean;

  @ApiProperty({ description: "댓글 총 좋아요 수", example: 2 })
  likeCount!: number;

  @ApiProperty({ description: "현재 사용자의 댓글 좋아요 여부", example: false })
  likedByMe!: boolean;

  @ApiProperty({
    description: "대댓글 목록",
    type: () => CommunityCommentResponseDto,
    isArray: true,
  })
  replies!: CommunityCommentResponseDto[];
}
