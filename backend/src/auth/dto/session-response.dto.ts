import { ApiProperty } from "@nestjs/swagger";

export class SessionUserDto {
  @ApiProperty({ description: "사용자 식별자", example: "5c47b0f3-11c0-4ec6-8e3a-123456789abc" })
  id!: string;

  @ApiProperty({ description: "로그인 이메일", example: "user@example.com" })
  email!: string;

  @ApiProperty({ description: "서비스 표시 이름", example: "홍길동", nullable: true })
  displayName!: string | null;

  @ApiProperty({ description: "인증 제공자", example: "google" })
  authProvider!: string;
}

export class SessionProfileDto {
  @ApiProperty({ description: "공개 이름", example: "홍길동", nullable: true })
  realName!: string | null;

  @ApiProperty({ description: "공개 성별", example: "남성", nullable: true })
  gender!: string | null;

  @ApiProperty({ description: "공개 나이대", example: "30대", nullable: true })
  ageRange!: string | null;

  @ApiProperty({ description: "활동 국가", example: "대한민국", nullable: true })
  country!: string | null;

  @ApiProperty({ description: "활동 도시", example: "서울특별시", nullable: true })
  city!: string | null;
}

export class SessionResponseDto {
  @ApiProperty({ description: "로그인 여부", example: true })
  isAuthenticated!: boolean;

  @ApiProperty({
    description: "세션 만료 시각",
    example: "2026-04-27T00:00:00.000Z",
    nullable: true,
  })
  expiresAt!: string | null;

  @ApiProperty({ description: "필수 프로필 정보 입력 완료 여부", example: false })
  profileComplete!: boolean;

  @ApiProperty({
    description: "현재 사용자 정보",
    type: SessionUserDto,
    nullable: true,
  })
  user!: SessionUserDto | null;

  @ApiProperty({
    description: "현재 프로필 정보",
    type: SessionProfileDto,
    nullable: true,
  })
  profile!: SessionProfileDto | null;
}
