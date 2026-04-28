# Current Task

## 작업명
한국뉴스 전용 + Tavily Search 보조검색 전환

## 목표
- VARO MVP의 검토 범위를 한국 관련 정치·경제 claim으로 고정한다.
- 해외/글로벌 뉴스 claim은 `unsupported/out_of_scope`로 처리한다.
- Tavily Search는 제거하지 않고 한국 뉴스 보조 source search provider로 유지한다.
- review preview 대기 시간을 줄이기 위해 Naver timeout/partial 처리와 OpenAI 분류 호출 수를 조정한다.

## 이번 작업 범위
- `docs/prd.md`
- `docs/product-spec.md`
- `docs/backend-spec.md`
- `docs/review-query-processing.md`
- `docs/data-model.md`
- `docs/architecture.md`
- `docs/erd.md`
- `tasks/backlog.md`
- `tasks/decisions.md`
- `tasks/current-task.md`
- `backend/src/reviews`
- `backend/src/config/app.config.ts`
- `backend/.env.example`

## 제외 범위
- 공개 API 응답 shape 변경
- DB schema / Prisma migration 변경
- 사용자가 입력 전에 정치/경제를 직접 선택하는 UI
- 직접 기사 HTML 스크래핑 구현
