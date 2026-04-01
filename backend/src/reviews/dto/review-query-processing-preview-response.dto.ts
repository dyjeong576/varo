import { ApiProperty } from "@nestjs/swagger";

export class ReviewQueryArtifactDto {
  @ApiProperty({ description: "query 식별자", example: "q1" })
  id!: string;

  @ApiProperty({ description: "생성된 query 텍스트", example: "테슬라 한국 사업 철수" })
  text!: string;

  @ApiProperty({ description: "query 순번", example: 1 })
  rank!: number;
}

export class ReviewCandidateDto {
  @ApiProperty({ description: "source 식별자", example: "source-1" })
  id!: string;

  @ApiProperty({ description: "출처 유형", example: "official" })
  sourceType!: string;

  @ApiProperty({ description: "출처명", example: "정부부처 보도자료", nullable: true })
  publisherName!: string | null;

  @ApiProperty({ description: "정규화 URL", example: "https://news.example.com/articles/varo-core" })
  canonicalUrl!: string;

  @ApiProperty({ description: "원문 제목", example: "테슬라 한국 사업 관련 공식 입장" })
  rawTitle!: string;

  @ApiProperty({
    description: "검색 snippet",
    example: "테슬라의 한국 사업 운영 계획과 관련된 공식 설명입니다.",
    nullable: true,
  })
  rawSnippet!: string | null;

  @ApiProperty({
    description: "relevance 단계",
    example: "primary",
    enum: ["primary", "reference", "discard"],
  })
  relevanceTier!: string;

  @ApiProperty({
    description: "relevance 판정 이유",
    example: "핵심 claim과 직접 관련된 제목 또는 공식 출처 신호가 확인됩니다.",
    nullable: true,
  })
  relevanceReason!: string | null;

  @ApiProperty({
    description: "이 source를 찾은 query 식별자 목록",
    example: ["q1", "q2"],
    type: [String],
  })
  originQueryIds!: string[];
}

export class ReviewEvidenceSnippetDto {
  @ApiProperty({ description: "snippet 식별자", example: "snippet-1" })
  id!: string;

  @ApiProperty({ description: "연결된 source 식별자", example: "source-1" })
  sourceId!: string;

  @ApiProperty({
    description: "interpretation 단계에 넘길 snippet 텍스트",
    example: "테슬라의 한국 사업 운영 계획에 변화가 없다고 회사가 설명했습니다.",
  })
  snippetText!: string;
}

export class ReviewInterpretationHandoffDto {
  @ApiProperty({ description: "정제된 핵심 claim", example: "테슬라의 한국 시장 철수" })
  coreClaim!: string;

  @ApiProperty({
    description: "interpretation 단계로 넘길 source 식별자 목록",
    example: ["source-1", "source-2"],
    type: [String],
  })
  sourceIds!: string[];

  @ApiProperty({
    description: "interpretation 단계로 넘길 snippet 식별자 목록",
    example: ["snippet-1", "snippet-2"],
    type: [String],
  })
  snippetIds!: string[];

  @ApiProperty({
    description: "근거 부족 시 handoff에 포함할 설명",
    example: "primary source가 충분하지 않아 reference 일부만 승격되었습니다.",
    nullable: true,
  })
  insufficiencyReason!: string | null;
}

export class ReviewQueryProcessingPreviewResponseDto {
  @ApiProperty({ description: "review job 식별자", example: "review-1" })
  reviewId!: string;

  @ApiProperty({ description: "claim 식별자", example: "claim-1" })
  claimId!: string;

  @ApiProperty({ description: "review 상태", example: "partial" })
  status!: string;

  @ApiProperty({ description: "현재 stage", example: "handoff_ready" })
  currentStage!: string;

  @ApiProperty({
    description: "정규화된 claim",
    example: "테슬라가 한국에서 완전 철수한대",
  })
  normalizedClaim!: string;

  @ApiProperty({ description: "언어 코드", example: "ko" })
  languageCode!: string;

  @ApiProperty({ description: "핵심 claim", example: "테슬라의 한국 시장 철수" })
  coreClaim!: string;

  @ApiProperty({ description: "생성된 query 목록", type: [ReviewQueryArtifactDto] })
  generatedQueries!: ReviewQueryArtifactDto[];

  @ApiProperty({ description: "후보 source 목록", type: [ReviewCandidateDto] })
  sources!: ReviewCandidateDto[];

  @ApiProperty({ description: "생성된 evidence snippet 목록", type: [ReviewEvidenceSnippetDto] })
  evidenceSnippets!: ReviewEvidenceSnippetDto[];

  @ApiProperty({ description: "검색된 source 수", example: 12 })
  searchedSourceCount!: number;

  @ApiProperty({ description: "선별된 extraction 대상 source 수", example: 4 })
  selectedSourceCount!: number;

  @ApiProperty({ description: "discard된 source 수", example: 3 })
  discardedSourceCount!: number;

  @ApiProperty({
    description: "interpretation 단계 전달용 payload",
    type: ReviewInterpretationHandoffDto,
  })
  handoff!: ReviewInterpretationHandoffDto;
}
