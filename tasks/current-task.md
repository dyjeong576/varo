# Current Task

## 작업명
비로그인 코어 서비스 공개 전환

## 목표
- 홈, answer 생성/조회, 히스토리, 인기 주제, 헤드라인을 비로그인 사용자도 이용할 수 있게 한다.
- 커뮤니티, 알림, 설정, 내 정보, 온보딩 프로필은 로그인 전용으로 유지한다.
- 비로그인 사용자는 HttpOnly 게스트 쿠키 기반 브라우저별 기록을 사용한다.

## 이번 작업 범위
- `tasks/current-task.md`
- `tasks/decisions.md`
- `docs/prd.md`
- frontend main layout과 계정 전용 route guard
- backend guest session 모델, guard, answer actor 처리
- popular/headlines 공개 조회 처리
- 관련 테스트

## 제외 범위
- 게스트 결과의 로그인 계정 자동 병합
- 커뮤니티 비로그인 읽기/쓰기
- 알림/설정/내 정보 비로그인 공개
