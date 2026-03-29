import { ApiProperty } from "@nestjs/swagger";

export class ApiErrorResponseDto {
  @ApiProperty({ description: "HTTP 상태 코드", example: 401 })
  statusCode!: number;

  @ApiProperty({ description: "도메인 에러 코드", example: "AUTH_REQUIRED" })
  code!: string;

  @ApiProperty({ description: "사용자 노출 메시지", example: "로그인이 필요합니다." })
  message!: string;

  @ApiProperty({ description: "추적용 trace id", example: "c3f9f22b-2400-4d51-9f4c-111111111111" })
  traceId!: string;

  @ApiProperty({ description: "에러 발생 시각", example: "2026-03-27T12:00:00.000Z" })
  timestamp!: string;

  @ApiProperty({ description: "요청 경로", example: "/api/v1/users/me" })
  path!: string;
}
