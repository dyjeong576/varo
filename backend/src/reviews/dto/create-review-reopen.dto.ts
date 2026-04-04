import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";

export const REVIEW_REOPEN_SOURCES = ["popular", "history", "notification"] as const;
export type ReviewReopenSource = (typeof REVIEW_REOPEN_SOURCES)[number];

export class CreateReviewReopenDto {
  @ApiProperty({
    description: "리뷰 재진입 source",
    enum: REVIEW_REOPEN_SOURCES,
    example: "popular",
  })
  @IsString()
  @IsIn(REVIEW_REOPEN_SOURCES)
  source!: ReviewReopenSource;
}
