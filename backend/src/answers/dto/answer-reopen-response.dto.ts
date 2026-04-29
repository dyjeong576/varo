import { ApiProperty } from "@nestjs/swagger";

export class AnswerReopenResponseDto {
  @ApiProperty({ description: "재진입 이벤트 저장 성공 여부", example: true })
  ok!: true;
}
