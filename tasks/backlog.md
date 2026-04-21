# Backlog

## 검색 Provider Routing 구현

- query refinement artifact에 `search_route`와 `search_route_reason`을 추가한다.
- `korean_news` route는 현재 연결된 Naver News Search client 경로를 명시적인 route 분기로 정리한다.
- `global_news` route에서는 Tavily Search/Extract로 source candidate와 본문을 수집한다.
- `unsupported` route는 뉴스성 또는 사실성 검토 대상이 아닌 claim에만 사용하고 `out_of_scope`로 기록한다.
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_SEARCH_TIMEOUT_MS` env validation을 추가한다.
- provider별 실패 원인을 `external_request_logs.provider`와 내부 error detail에 구분해 남긴다.

## Review history 중복 및 loading 재시도 상태 오류 수정

- claim 등록 직후 우측 메뉴의 최근 검증 리포트에 같은 claim이 중복 노출되지 않게 한다.
- local pending draft와 server review job을 `clientRequestId` 기준으로 병합한다.
- `/loading` 페이지의 근거 수집 재시도에서 실제 review 상태가 실패면 성공 UI로 처리하지 않게 한다.
- 실패한 review도 추적 가능하도록 review 식별자와 오류 상태를 유지한다.
- 관련 백엔드 계약, 프론트 타입, 회귀 테스트를 함께 정리한다.

### 기존 범위
- `backend/src/reviews` review preview summary/detail 응답 계약
- `frontend/lib/reviews` task store, history merge, 타입/mapper
- `frontend/app/(main)/loading/page.tsx`
- 관련 backend unit/e2e 테스트
- frontend lint 및 수동 검증 기준 정리
