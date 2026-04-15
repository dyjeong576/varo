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

  @ApiProperty({ description: "원문 URL", example: "https://news.example.com/articles/varo-core?from=search" })
  originalUrl!: string;

  @ApiProperty({
    description: "발행 시각",
    example: "2026-04-01T01:00:00.000Z",
    nullable: true,
  })
  publishedAt!: string | null;

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

  @ApiProperty({
    description: "source가 속한 국가 코드",
    example: "KR",
    nullable: true,
  })
  sourceCountryCode!: string | null;

  @ApiProperty({
    description: "이 source를 확보한 retrieval bucket",
    example: "verification",
    enum: ["familiar", "verification", "fallback"],
    nullable: true,
  })
  retrievalBucket!: string | null;

  @ApiProperty({
    description: "국가별 도메인 레지스트리와 매칭됐는지 여부",
    example: true,
  })
  domainRegistryMatched!: boolean;

  @ApiProperty({
    description: "이 source가 claim에 대해 보이는 방향성",
    example: "support",
    enum: ["support", "conflict", "context", "unknown"],
  })
  stance!: string;
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

export class ReviewSourceBreakdownDto {
  @ApiProperty({ description: "공식 출처 수", example: 2 })
  official!: number;

  @ApiProperty({ description: "언론 출처 수", example: 5 })
  press!: number;

  @ApiProperty({ description: "소셜 출처 수", example: 1 })
  social!: number;

  @ApiProperty({ description: "해설 출처 수", example: 1 })
  analysis!: number;

  @ApiProperty({ description: "기타 출처 수", example: 0 })
  other!: number;
}

export class ReviewAnalysisResultDto {
  @ApiProperty({
    description: "현재 결과가 규칙 기반 임시 결과인지 여부",
    example: "rule_based_preview",
  })
  mode!: string;

  @ApiProperty({
    description: "수집된 출처 기준 임시 verdict",
    example: "Likely True",
    enum: ["Likely True", "Mixed Evidence", "Unclear", "Likely False"],
  })
  verdict!: string;

  @ApiProperty({ description: "규칙 기반 confidence 점수", example: 84 })
  confidenceScore!: number;

  @ApiProperty({
    description: "출처 간 합의 수준",
    example: "high",
    enum: ["high", "medium", "low"],
  })
  consensusLevel!: string;

  @ApiProperty({
    description: "결과 화면용 해석 요약",
    example:
      "수집된 출처 기준으로는 이 주장을 지지하는 근거가 더 우세합니다. verification 성격의 source가 포함돼 있어 현재 단계 기준 신뢰도는 비교적 높습니다.",
  })
  analysisSummary!: string;

  @ApiProperty({
    description: "결과 화면용 uncertainty 요약",
    example:
      "현재 결과는 interpretation 단계 이전에 생성된 임시 분석입니다. 추가 source 확보 여부에 따라 해석 강도가 달라질 수 있습니다.",
  })
  uncertaintySummary!: string;

  @ApiProperty({
    description: "세부 uncertainty 항목",
    example: ["verification source가 충분하지 않습니다."],
    type: [String],
  })
  uncertaintyItems!: string[];

  @ApiProperty({ description: "지지 근거 수", example: 3 })
  agreementCount!: number;

  @ApiProperty({ description: "충돌 근거 수", example: 1 })
  conflictCount!: number;

  @ApiProperty({ description: "맥락 보완 근거 수", example: 2 })
  contextCount!: number;

  @ApiProperty({
    description: "출처 유형 분포",
    type: ReviewSourceBreakdownDto,
  })
  sourceBreakdown!: ReviewSourceBreakdownDto;
}

export class ReviewQueryProcessingPreviewResponseDto {
  @ApiProperty({ description: "review job 식별자", example: "review-1" })
  reviewId!: string;

  @ApiProperty({
    description: "client에서 생성한 요청 식별자. local pending draft와 server review job 병합에 사용합니다.",
    example: "pending:review-1",
    nullable: true,
  })
  clientRequestId!: string | null;

  @ApiProperty({ description: "claim 식별자", example: "claim-1" })
  claimId!: string;

  @ApiProperty({
    description: "사용자가 입력한 claim 원문",
    example: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
  })
  rawClaim!: string;

  @ApiProperty({
    description: "review job 생성 시각",
    example: "2026-04-01T02:00:00.000Z",
  })
  createdAt!: string;

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

  @ApiProperty({ description: "claim 언어 코드", example: "ko" })
  claimLanguageCode!: string;

  @ApiProperty({ description: "핵심 claim", example: "테슬라의 한국 시장 철수" })
  coreClaim!: string;

  @ApiProperty({
    description: "주제 범위",
    example: "foreign",
    enum: ["domestic", "foreign", "multi_country", "unknown"],
  })
  topicScope!: string;

  @ApiProperty({
    description: "주제 국가 코드",
    example: "US",
    nullable: true,
  })
  topicCountryCode!: string | null;

  @ApiProperty({
    description: "주제 국가 판정 이유",
    example: "미국 정치 고유명사가 확인되어 미국 이슈로 판단했습니다.",
  })
  countryDetectionReason!: string;

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

  @ApiProperty({
    description:
      "최종 truth 판정이 아닌, 현재 수집된 출처를 기준으로 계산한 임시 결과 화면용 분석 데이터",
    type: ReviewAnalysisResultDto,
  })
  result!: ReviewAnalysisResultDto;
}
