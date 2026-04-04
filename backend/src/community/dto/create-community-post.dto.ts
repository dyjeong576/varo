import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString, MaxLength } from "class-validator";

const COMMUNITY_CATEGORIES = ["Issue", "Policy", "FactCheck"] as const;

export class CreateCommunityPostDto {
  @ApiProperty({
    description: "게시글 카테고리",
    example: "Issue",
    enum: COMMUNITY_CATEGORIES,
  })
  @IsString()
  @IsIn(COMMUNITY_CATEGORIES)
  category!: (typeof COMMUNITY_CATEGORIES)[number];

  @ApiProperty({
    description: "게시글 제목",
    example: "전기차 화재 관련 보도의 객관성 토론",
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    description: "게시글 본문",
    example: "최근 보도 경향이 실제 통계와 얼마나 일치하는지 함께 검토해보고 싶습니다.",
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
