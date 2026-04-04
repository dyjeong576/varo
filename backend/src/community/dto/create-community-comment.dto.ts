import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Allow, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCommunityCommentDto {
  @ApiProperty({
    description: "댓글 본문",
    example: "공식 발표 원문 링크도 함께 보면 더 좋을 것 같습니다.",
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content!: string;

  @ApiPropertyOptional({
    description: "대댓글 대상 상위 댓글 식별자",
    example: "comment-1",
  })
  @Allow()
  @IsOptional()
  @IsString()
  parentCommentId?: string;
}
