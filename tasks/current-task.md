# Current Task

## 작업명
글로벌 검색 provider routing 전환

## 목표
- MVP 검색 범위를 국가 무관 뉴스성 claim 전체로 정리한다.
- `search_route`를 `korean_news / global_news / unsupported` 기준으로 실제 review pipeline에 연결한다.
- 한국 뉴스성 claim은 Naver, 해외/글로벌 뉴스성 claim은 Tavily Search/Extract를 사용한다.
- 글로벌 route에서는 사용자-facing query는 원문 유지, Tavily 검색 입력만 영어 아티팩트로 사용한다.

## 이번 작업 범위
- `backend/src/reviews/providers`
- `backend/src/reviews/reviews.providers.service.ts`
- `backend/src/reviews/query-preview`
- `docs/prd.md`
- `docs/backend-spec.md`
- `docs/review-query-processing.md`
- `docs/data-model.md`
- `tasks/decisions.md`
- 관련 backend 단위 테스트 및 build 검증

## 제외 범위
- Prisma migration
- frontend 화면 구현
