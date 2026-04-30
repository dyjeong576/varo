# Current Task

## 작업명
Answer Provider Routing 비용 최적화

## 목표
- Perplexity 사용 비용을 줄이기 위해 answer 생성 경로를 OpenAI 중심으로 전환한다.
- query refinement는 항상 OpenAI로 수행한다.
- 출처 기반 사실성 검토 대상이면 Naver News Search로 출처를 수집하고 OpenAI로 relevance/evidence/summary를 생성한다.
- 출처 기반 사실성 검토 대상이 아니면 out_of_scope로 막지 않고 Perplexity 직접 답변으로 처리한다.

## 이번 작업 범위
- `docs/prd.md`
- `tasks/decisions.md`
- `tasks/current-task.md`
- `backend/src/answers`
- `frontend/app/(main)/answers/[answerId]`
- `frontend/components/answers`
- `frontend/lib/answers`

## 제외 범위
- DB schema 변경
- Naver/Tavily provider 자체 교체
- Perplexity direct answer API 계약 변경
- 한국 정치·경제 밖 사실성 check 지원 확대
