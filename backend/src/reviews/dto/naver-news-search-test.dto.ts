import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { ReviewCandidateDto } from "./review-query-processing-preview-response.dto";

export const NAVER_NEWS_SEARCH_SORTS = ["sim", "date"] as const;
export type NaverNewsSearchSort = (typeof NAVER_NEWS_SEARCH_SORTS)[number];

export class NaverNewsSearchTestRequestDto {
  @ApiProperty({
    description: "네이버 뉴스 검색 query",
    example: "테슬라 한국 철수",
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;

  @ApiPropertyOptional({
    description: "검색 결과 개수",
    example: 5,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  display?: number;

  @ApiPropertyOptional({
    description: "검색 시작 위치",
    example: 1,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  start?: number;

  @ApiPropertyOptional({
    description: "검색 정렬 방식",
    enum: NAVER_NEWS_SEARCH_SORTS,
    example: "sim",
  })
  @IsOptional()
  @IsString()
  @IsIn(NAVER_NEWS_SEARCH_SORTS)
  sort?: NaverNewsSearchSort;
}

export class NaverNewsSearchTestResponseDto {
  @ApiProperty({ description: "검색 query", example: "테슬라 한국 철수" })
  query!: string;

  @ApiProperty({ description: "검색 결과 개수", example: 5 })
  display!: number;

  @ApiProperty({ description: "검색 시작 위치", example: 1 })
  start!: number;

  @ApiProperty({
    description: "검색 정렬 방식",
    enum: NAVER_NEWS_SEARCH_SORTS,
    example: "sim",
  })
  sort!: NaverNewsSearchSort;

  @ApiProperty({
    description: "네이버 뉴스 검색 결과를 정규화한 source 후보 목록",
    type: ReviewCandidateDto,
    isArray: true,
  })
  items!: ReviewCandidateDto[];
}
