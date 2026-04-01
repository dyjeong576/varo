import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateReviewQueryProcessingPreviewDto {
  @ApiProperty({
    description: "검토할 사용자 claim 원문",
    example: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  claim!: string;
}
