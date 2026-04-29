# Current Task

## 작업명
check/answer 명칭 전환

## 목표
- 코드, API, 문서에서 검토 대상 입력 단위는 `check`으로 통일한다.
- 코드, API, 문서에서 검토 결과 단위는 `answer`로 통일한다.
- DB schema와 migration도 `checks`, `answer_jobs`, `check_id`, `answer_job_id` 기준으로 전환한다.

## 이번 작업 범위
- `docs/prd.md`
- `docs/product-spec.md`
- `docs/backend-spec.md`
- `docs/answer-query-processing.md`
- `docs/data-model.md`
- `docs/architecture.md`
- `docs/erd.md`
- `tasks/backlog.md`
- `tasks/decisions.md`
- `tasks/current-task.md`
- `backend/src/answers`
- `frontend/lib/api/client.ts`
- `frontend/lib/answers`
- `frontend/app/(main)/loading/page.tsx`
- `frontend/app/(main)/answers/[answerId]/page.tsx`
- `backend/src/config/app.config.ts`
- `backend/.env.example`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations`

## 제외 범위
- 기능 동작 방식 변경
- 사용자가 입력 전에 정치/경제를 직접 선택하는 UI
- 직접 기사 HTML 스크래핑 구현
