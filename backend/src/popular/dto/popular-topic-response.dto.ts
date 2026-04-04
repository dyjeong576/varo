import { ApiProperty } from "@nestjs/swagger";

export class PopularTopicResponseDto {
  @ApiProperty({ description: "인기 topic 그룹 키", example: "테슬라 한국 철수" })
  topicKey!: string;

  @ApiProperty({ description: "사용자 노출용 topic 텍스트", example: "테슬라 한국 철수" })
  topicText!: string;

  @ApiProperty({ description: "순위", example: 1 })
  rank!: number;

  @ApiProperty({ description: "최근 24시간 인기 점수", example: 18 })
  popularityScore!: number;

  @ApiProperty({ description: "최근 24시간 submitted 수", example: 12 })
  reviewCount!: number;

  @ApiProperty({ description: "최근 24시간 meaningful reopen 수", example: 6 })
  reopenCount!: number;

  @ApiProperty({
    description: "직전 24시간 대비 추세",
    enum: ["up", "down", "steady"],
    example: "up",
  })
  trend!: "up" | "down" | "steady";

  @ApiProperty({
    description: "직전 24시간 대비 증감률",
    example: 50,
    nullable: true,
  })
  trendValue!: number | null;

  @ApiProperty({
    description: "대표 review preview 식별자",
    example: "review-1",
  })
  representativeReviewId!: string;

  @ApiProperty({
    description: "최근 popularity 활동 시각",
    example: "2026-04-04T12:00:00.000Z",
  })
  updatedAt!: string;
}
