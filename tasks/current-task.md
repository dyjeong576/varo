# Current Task

## 작업명
오늘의 헤드라인 v1

## 목표
- 매일 새벽 1시(KST)에 주요 매체 RSS 헤드라인을 수집해 DB에 저장한다.
- `/headlines`에서 정치/경제별 오늘의 헤드라인을 비교해 보여준다.
- 수집된 RSS 제목/요약/매체명만 기반으로 사건별 표현 비교 분석을 제공한다.

## 이번 작업 범위
- `docs/prd.md`
- `tasks/decisions.md`
- `tasks/current-task.md`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations`
- `backend/src/headlines`
- `backend/src/app.module.ts`
- `backend/src/config/app.config.ts`
- `backend/.env.example`
- `frontend/app/(main)/headlines`
- `frontend/components/headlines`
- `frontend/components/layout/main-shell.tsx`
- `frontend/lib/api/client.ts`
- `frontend/lib/types/headlines.ts`

## 2026-04-30 추가 변경
- 경제 RSS 수집 feed를 추가한다.
- `/headlines` 화면 메뉴를 `헤드라인 / 분석`에서 `정치 / 경제`로 변경한다.
- 헤드라인 API가 `category=politics|economy`로 정치/경제 RSS 조회, 분석 조회, 수동 수집 범위를 지정할 수 있게 한다.
- `/headlines` 화면에서 RSS 기사 시간 표기를 제거하고 실시간 조회 대신 날짜 검색을 제공한다.
- 날짜 검색은 2026-04-30부터 선택할 수 있게 제한한다.
- 선택 날짜/카테고리에서 수집된 기사를 모두 노출한다.
- `/headlines` 화면은 AI가 사건별로 그룹화한 헤드라인 분석만 노출한다.
- 헤드라인 분석은 `date + category` 단위로 저장해 정치/경제 분석 결과가 섞이지 않게 한다.

## 제외 범위
- 기사 본문 HTML 스크래핑
- 매체별 신뢰도 점수화
- 사용자별 맞춤 매체 선택
- 관리자용 RSS 관리 UI
