import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";

export const ANSWER_REOPEN_SOURCES = ["popular", "history", "notification"] as const;
export type AnswerReopenSource = (typeof ANSWER_REOPEN_SOURCES)[number];

export class CreateAnswerReopenDto {
  @ApiProperty({
    description: "리뷰 재진입 source",
    enum: ANSWER_REOPEN_SOURCES,
    example: "popular",
  })
  @IsString()
  @IsIn(ANSWER_REOPEN_SOURCES)
  source!: AnswerReopenSource;
}
