import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateAnswerQueryProcessingPreviewDto {
  @ApiProperty({
    description: "검토할 사용자 check 원문",
    example: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  check!: string;

  @ApiPropertyOptional({
    description:
      "동일 브라우저 draft 재시도 시 같은 answer preview로 수렴시키기 위한 클라이언트 요청 식별자",
    example: "pending:0c4f2cf4-9f2f-4eb2-a5fb-e36f4f4dd8db",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  clientRequestId?: string;
}
