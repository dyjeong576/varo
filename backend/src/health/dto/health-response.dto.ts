import { ApiProperty } from "@nestjs/swagger";

export class HealthResponseDto {
  @ApiProperty({
    description: "서비스 상태",
    example: "ok",
  })
  status!: "ok";

  @ApiProperty({
    description: "응답한 서비스 이름",
    example: "backend",
  })
  service!: "backend";

  @ApiProperty({
    description: "DB 연결 확인 여부",
    example: true,
  })
  database!: boolean;

  @ApiProperty({
    description: "응답 생성 시각",
    example: "2026-04-05T12:00:00.000Z",
  })
  checkedAt!: string;
}
