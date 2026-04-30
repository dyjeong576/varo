import { ApiProperty } from "@nestjs/swagger";

export class HeadlineArticleDto {
  @ApiProperty({ description: "기사 식별자", example: "article-1" })
  id!: string;

  @ApiProperty({ description: "매체 key", example: "khan-politics" })
  publisherKey!: string;

  @ApiProperty({ description: "매체명", example: "경향신문" })
  publisherName!: string;

  @ApiProperty({ description: "헤드라인 카테고리", example: "politics", enum: ["politics", "economy"] })
  category!: string;

  @ApiProperty({ description: "기사 제목", example: "정부, 새 경제 대책 발표" })
  title!: string;

  @ApiProperty({ description: "원문 URL", example: "https://news.example.com/article/1" })
  url!: string;

  @ApiProperty({ description: "RSS 요약", nullable: true })
  summary!: string | null;

  @ApiProperty({ description: "발행시각", nullable: true })
  publishedAt!: string | null;
}

export class HeadlinePublisherGroupDto {
  @ApiProperty({ description: "매체 key", example: "khan-politics" })
  publisherKey!: string;

  @ApiProperty({ description: "매체명", example: "경향신문" })
  publisherName!: string;

  @ApiProperty({ description: "헤드라인 카테고리", example: "politics", enum: ["politics", "economy"] })
  category!: string;

  @ApiProperty({ description: "RSS URL", example: "https://www.khan.co.kr/rss/rssdata/politic_news.xml" })
  feedUrl!: string;

  @ApiProperty({ description: "기사 목록", type: [HeadlineArticleDto] })
  articles!: HeadlineArticleDto[];
}

export class HeadlineScrapeRunDto {
  @ApiProperty({ description: "헤드라인 카테고리", example: "politics", enum: ["politics", "economy"] })
  category!: string;

  @ApiProperty({ description: "수집 실행 상태", example: "completed" })
  status!: string;

  @ApiProperty({ description: "실행 트리거", example: "cron" })
  trigger!: string;

  @ApiProperty({ description: "수집 시작시각" })
  startedAt!: string;

  @ApiProperty({ description: "수집 종료시각", nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ description: "RSS에서 읽은 기사 수", example: 80 })
  fetchedCount!: number;

  @ApiProperty({ description: "DB에 새로 저장한 기사 수", example: 24 })
  savedCount!: number;

  @ApiProperty({ description: "오류 메시지", nullable: true })
  errorMessage!: string | null;
}

export class HeadlineScrapeResponseDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({ description: "수집 날짜", example: "2026-04-30" })
  dateKey!: string;

  @ApiProperty({ description: "RSS에서 읽은 기사 수", example: 80 })
  fetchedCount!: number;

  @ApiProperty({ description: "DB에 새로 저장한 기사 수", example: 24 })
  savedCount!: number;
}

export class HeadlinesTodayResponseDto {
  @ApiProperty({ description: "조회 날짜", example: "2026-04-30" })
  dateKey!: string;

  @ApiProperty({ description: "전체 기사 수", example: 64 })
  totalArticleCount!: number;

  @ApiProperty({ description: "마지막 수집 실행", type: HeadlineScrapeRunDto, nullable: true })
  lastScrapeRun!: HeadlineScrapeRunDto | null;

  @ApiProperty({ description: "매체별 헤드라인", type: [HeadlinePublisherGroupDto] })
  publishers!: HeadlinePublisherGroupDto[];
}

export class HeadlineClusterItemDto {
  @ApiProperty({ description: "기사 식별자", nullable: true })
  articleId!: string | null;

  @ApiProperty({ description: "매체 key", example: "sbs-politics" })
  publisherKey!: string;

  @ApiProperty({ description: "매체명", example: "SBS" })
  publisherName!: string;

  @ApiProperty({ description: "기사 제목" })
  articleTitle!: string;

  @ApiProperty({ description: "기사 URL" })
  articleUrl!: string;

  @ApiProperty({ description: "이 기사 제목이 사건을 표현한 방식" })
  expressionSummary!: string;

  @ApiProperty({ description: "강조점", nullable: true })
  emphasis!: string | null;

  @ApiProperty({ description: "표현 프레이밍", nullable: true })
  framing!: string | null;
}

export class HeadlineEventClusterDto {
  @ApiProperty({ description: "사건 묶음 식별자" })
  id!: string;

  @ApiProperty({ description: "사건명" })
  eventName!: string;

  @ApiProperty({ description: "사건 요약" })
  eventSummary!: string;

  @ApiProperty({ description: "공통 사실", type: [String] })
  commonFacts!: string[];

  @ApiProperty({ description: "불확실성", nullable: true })
  uncertainty!: string | null;

  @ApiProperty({ description: "매체별 표현", type: [HeadlineClusterItemDto] })
  items!: HeadlineClusterItemDto[];
}

export class HeadlinesAnalysisResponseDto {
  @ApiProperty({ description: "분석 날짜", example: "2026-04-30" })
  dateKey!: string;

  @ApiProperty({ description: "분석 상태", example: "ready", enum: ["pending", "ready", "failed"] })
  status!: string;

  @ApiProperty({ description: "전체 분석 요약", nullable: true })
  summary!: string | null;

  @ApiProperty({ description: "오류 메시지", nullable: true })
  errorMessage!: string | null;

  @ApiProperty({ description: "사건 묶음", type: [HeadlineEventClusterDto] })
  clusters!: HeadlineEventClusterDto[];
}
