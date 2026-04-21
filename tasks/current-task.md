# Current Task

## 작업명
Naver client review pipeline 1차 연동

## 목표
- 한국 관련 claim의 review query source search를 Naver News Search client로 전환한다.
- 기존 query-processing-preview 저장, relevance filtering, extraction 흐름은 유지한다.
- `search_route` 전면 전환 없이 현재 `isKoreaRelated` 기준 흐름에 Naver 검색을 연결한다.

## 이번 작업 범위
- `backend/src/reviews/providers`
- `backend/src/reviews/reviews.providers.service.ts`
- `backend/src/reviews/query-preview`
- 관련 backend 단위 테스트 및 build 검증

## 제외 범위
- Prisma migration
- review pipeline의 `search_route` 전면 연결
- 해외/global Tavily 지원 확대
- frontend 화면 구현
