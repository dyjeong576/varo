import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CompleteProfileDto {
  @ApiProperty({ description: "공개 이름", example: "홍길동" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  realName!: string;

  @ApiProperty({ description: "공개 성별", example: "남성" })
  @IsString()
  @IsIn(["남성", "여성", "기타", "응답 안 함"])
  gender!: string;

  @ApiProperty({ description: "공개 나이대", example: "30대" })
  @IsString()
  @IsIn(["10대", "20대", "30대", "40대", "50대", "60대 이상"])
  ageRange!: string;

  @ApiProperty({ description: "활동 국가", example: "대한민국" })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  country!: string;

  @ApiProperty({ description: "활동 도시", example: "서울특별시" })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  city!: string;
}

export class UpdateProfileDto extends PartialType(CompleteProfileDto) {
  @ApiPropertyOptional({ description: "공개 이름", example: "홍길동" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  override realName?: string;

  @ApiPropertyOptional({ description: "공개 성별", example: "남성" })
  @IsOptional()
  @IsString()
  @IsIn(["남성", "여성", "기타", "응답 안 함"])
  override gender?: string;

  @ApiPropertyOptional({ description: "공개 나이대", example: "30대" })
  @IsOptional()
  @IsString()
  @IsIn(["10대", "20대", "30대", "40대", "50대", "60대 이상"])
  override ageRange?: string;

  @ApiPropertyOptional({ description: "활동 국가", example: "대한민국" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  override country?: string;

  @ApiPropertyOptional({ description: "활동 도시", example: "서울특별시" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  override city?: string;
}
