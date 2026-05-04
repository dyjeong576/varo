# Current Task

## 작업명
설명형 질문용 context answer with news 모드 추가

## 목표
- 한국 정치·경제 설명형 질문에 대해 fact-check verdict 없이 OpenAI 맥락 답변과 Naver 관련 뉴스를 함께 제공한다.
- 기존 fact-check 흐름은 유지하고 verdict는 `answerMode=fact_check`에서만 노출한다.
- `checkType` 확장이 아니라 `answerMode`로 처리 모드를 구분한다.

## 이번 작업 범위
- `tasks/current-task.md`
- `tasks/decisions.md`
- `docs/prd.md`
- backend answer mode 타입, query refinement, context answer with news 분기
- frontend answer result 화면의 answer mode별 표시
- 관련 테스트

## 제외 범위
- fact-check verdict를 context answer mode에 생성하는 것
- DB migration
- 한국 정치·경제 밖 설명형 질문의 뉴스 검색 지원
