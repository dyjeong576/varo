import { ApiProperty } from "@nestjs/swagger";
import { CommunityCommentResponseDto } from "./community-comment-response.dto";
import { CommunityPostSummaryResponseDto } from "./community-post-summary-response.dto";

export class CommunityPostDetailResponseDto extends CommunityPostSummaryResponseDto {
  @ApiProperty({
    description: "게시글 댓글 목록",
    type: CommunityCommentResponseDto,
    isArray: true,
  })
  comments!: CommunityCommentResponseDto[];
}
