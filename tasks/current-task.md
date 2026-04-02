# Current Task

## 작업명
Review query processing real provider 및 `/reviews` preview 연동

## 목표
- `review-query-processing.md` 기준의 pre-interpretation review pipeline 구현
- claim 정규화, query refinement, source search, relevance filtering, extraction, handoff payload 생성 구현
- OpenAI query refinement / relevance filtering 실연동
- Tavily search / extract 실연동
- real mode 오류 정책과 테스트 보강
- `/reviews/[reviewId]`를 실제 review preview API와 연결

## 이번 작업 범위
- review query backend
- NestJS reviews provider real integration
- OpenAI / Tavily direct `fetch` 연동
- dev test endpoint와 인증 endpoint의 공통 provider 경로 유지
- `GET /api/v1/reviews`
- `GET /api/v1/reviews/:reviewId`
- 프론트 home submit → review preview 생성 → `/reviews/[reviewId]` 이동
- 프론트 history drawer / review detail 실제 API 연동
- 프론트 review task 전역 store로 loading / history / notification 상태 안정화
- provider / service 테스트

## 제외 범위
- interpretation 생성
- verdict 계산
- Redis queue
- 커뮤니티 / 알림 / 인기의 실제 백엔드 구현
