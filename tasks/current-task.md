# Current Task

## 작업명
Evidence Signal 기반 정보 합의성 고도화

## 목표
- OpenAI는 review 생성 시점에 evidence signal만 구조화한다.
- 백엔드는 저장된 signal을 기준으로 `consensusLevel`, `sourceStances`, `analysisSummary`를 조회 시점에 계산한다.
- 최신 연기/변경 signal이 기존 claim을 약화하거나 대체하면 과거 support 수가 많아도 합의성을 낮게 표시한다.

## 이번 작업 범위
- `backend/src/reviews/providers/reviews-openai.client.ts`
- `backend/src/reviews/reviews.providers.service.ts`
- `backend/src/reviews/query-preview/reviews-query-preview.service.ts`
- `backend/src/reviews/query-preview/reviews-query-preview.persistence.service.ts`
- `backend/src/reviews/query-preview/reviews-query-preview.mapper.ts`
- `backend/src/reviews/query-preview/review-result-assembler.ts`
- `docs/backend-spec.md`
- `docs/review-query-processing.md`
- `docs/data-model.md`
- `tasks/decisions.md`
- `tasks/current-task.md`

## 제외 범위
- 백엔드 API 계약 변경
- 신규 LLM 요약 호출 추가 또는 요약 문장 DB 저장
- DB schema / Prisma migration 변경
- 최종 interpretation pipeline 전환
