import { ApiProperty } from "@nestjs/swagger";

export class ReviewPreviewSummaryResponseDto {
  @ApiProperty({ description: "review job 식별자", example: "review-1" })
  reviewId!: string;

  @ApiProperty({
    description: "사용자가 입력한 claim 원문",
    example: "트럼프가 오늘 관세 발표했대",
  })
  rawClaim!: string;

  @ApiProperty({ description: "review 상태", example: "partial" })
  status!: string;

  @ApiProperty({ description: "현재 stage", example: "handoff_ready" })
  currentStage!: string;

  @ApiProperty({
    description: "review job 생성 시각",
    example: "2026-04-01T02:00:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({ description: "선별된 extraction 대상 source 수", example: 4 })
  selectedSourceCount!: number;

  @ApiProperty({
    description: "마지막 오류 코드",
    example: "REVIEW_PARTIAL",
    nullable: true,
  })
  lastErrorCode!: string | null;
}
