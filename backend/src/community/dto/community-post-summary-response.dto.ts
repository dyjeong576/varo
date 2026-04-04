import { ApiProperty } from "@nestjs/swagger";
import { CommunityAuthorResponseDto } from "./community-author-response.dto";

export class CommunityPostSummaryResponseDto {
  @ApiProperty({ description: "게시글 식별자", example: "post-1" })
  id!: string;

  @ApiProperty({
    description: "게시글 제목",
    example: "전기차 화재 관련 보도의 객관성 토론",
  })
  title!: string;

  @ApiProperty({
    description: "게시글 본문 요약 또는 전체",
    example:
      "최근 연이어 발생하는 전기차 화재 사고에 대한 언론 보도가 공포심을 조장하고 있다는 의견이 있습니다.",
  })
  content!: string;

  @ApiProperty({
    description: "커뮤니티 카테고리",
    example: "Issue",
    enum: ["Issue", "Policy", "FactCheck"],
  })
  category!: "Issue" | "Policy" | "FactCheck";

  @ApiProperty({ description: "게시글 작성자", type: CommunityAuthorResponseDto })
  author!: CommunityAuthorResponseDto;

  @ApiProperty({
    description: "게시글 작성 시각",
    example: "2026-04-02T02:00:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({ description: "공감 수", example: 45 })
  likeCount!: number;

  @ApiProperty({ description: "댓글 수", example: 12 })
  commentCount!: number;

  @ApiProperty({ description: "현재 사용자가 작성한 게시글인지 여부", example: false })
  isAuthor!: boolean;

  @ApiProperty({ description: "현재 사용자의 공감 여부", example: true })
  likedByMe!: boolean;
}
