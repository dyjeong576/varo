# Current Task

## 작업명
서버 알림 전면 연동

## 목표
- review 완료, 커뮤니티 댓글, 좋아요 알림을 서버 DB/API 기준으로 통합한다.
- 알림 목록, unread badge, 읽음 처리, 알림 설정을 모두 서버 기준으로 동작하게 전환한다.
- review/community mutation 흐름에서 실제 알림 생성까지 연동한다.

## 이번 작업 범위
- `backend/prisma` 알림 관련 스키마 및 migration
- `backend/src/notifications` API/DTO/service
- `backend/src/reviews`, `backend/src/community` 알림 이벤트 생성 연동
- `frontend/lib/notifications`, `frontend/lib/api`, `/notifications`, `/settings/notifications`, 앱 셸 badge
- 관련 backend 단위 테스트, frontend lint/build, 문서 갱신

## 제외 범위
- 브라우저 푸시, 이메일, 웹소켓 같은 실시간 전달 채널
- 커뮤니티 알림의 댓글 anchor deep link
- 기존 local notification state 마이그레이션
- 별도 worker fan-out 도입
