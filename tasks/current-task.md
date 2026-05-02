# Current Task

## 작업명
Perplexity provider 연결 해제

## 목표
- 비용 절감을 위해 신규 answer 생성 경로에서 Perplexity 호출을 끊고 OpenAI 기반 경로만 사용한다.

## 이번 작업 범위
- `tasks/current-task.md`
- `tasks/decisions.md`
- `docs/prd.md`
- `backend/src/config/app.config.ts`
- `backend/.env.example`
- `backend/src/answers/answers.module.ts`
- `backend/src/answers/answers.providers.service.ts`
- `backend/src/answers/query-preview/answers-query-preview.service.ts`
- 관련 테스트와 사용자 표시 문구

## 제외 범위
- `frontend/README.md` 변경
- 공개 API / DTO / DB schema 변경
- 기존 문서의 인코딩 깨짐 정리
