# Current Task

## 작업명
한국 관련 claim 전용 MVP scope 축소

## 목표
- MVP 검토 범위를 한국 관련 claim으로 제한한다.
- 순수 해외 이슈는 verdict를 만들지 않고 `out_of_scope` 상태로 기록한다.
- 검색은 KR source domain registry만 사용하고 domainless fallback search를 제거한다.
- 사용자 국가 코드는 audit 목적으로 유지하되 domain routing에는 사용하지 않는다.
- backend 응답 계약과 frontend 결과/loading/history UI가 `out_of_scope`를 정상 terminal 상태로 처리하게 한다.

## 이번 작업 범위
- `backend/src/reviews` query refinement, search orchestration, preview persistence/mapper, DTO
- `frontend/lib/reviews` 타입, mapper, task store
- `frontend/app/(main)/loading/page.tsx`
- `frontend/app/(main)/reviews/[reviewId]/page.tsx`
- 관련 backend unit/e2e 테스트
- PRD, decisions, current-task, backlog 문서 갱신

## 제외 범위
- interpretation 단계 LLM 결과 생성
- DB schema migration
- 비-KR registry row 삭제 또는 비활성화 migration
- 새로운 frontend 테스트 러너 도입
- 배포 인프라 변경
