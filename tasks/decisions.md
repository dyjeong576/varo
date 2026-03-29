# Decisions

## 2026-03-27

### 인증 / 세션
- 로그인 방식은 Google OAuth만 지원한다.
- 세션 모델은 서버 세션 + `HttpOnly` cookie 조합으로 구현한다.
- 세션 쿠키는 `SameSite=Lax`를 사용하고 `prod`에서만 `Secure=true`를 적용한다.
- 세션 TTL은 MVP 기준 30일 고정으로 유지한다.

### 프로필
- 첫 로그인 후 필수 프로필이 비어 있으면 `/onboarding/profile`에서 보완을 강제한다.
- 첫 로그인 시 입력 필드는 `real_name`, `gender`, `age_range`, `country`, `city`다.
- `real_name`, `gender`, `age_range`는 최초 1회만 설정 가능하다.
- 이후 수정 가능 필드는 `country`, `city`만 허용한다.

### 백엔드 구현
- 백엔드는 NestJS + Prisma + PostgreSQL 조합으로 구현한다.
- API prefix는 `/api/v1`로 고정한다.
- Swagger는 NestJS Swagger를 사용하고 문서는 한국어로 작성한다.
- Swagger UI는 `dev`에서만 `/api/docs`로 노출한다.

## 2026-03-29

### 브랜드
- 서비스 브랜드는 `VARO`를 사용한다.
- 사용자 노출 표기는 `VARO`로 고정한다.
- `Verified Analysis, Reasoned Opinion` 풀네임은 소개 문맥에서만 1회 사용한다.
- 로고 이미지 파일 자체 교체는 후속 작업으로 남기고, 이번 단계에서는 텍스트와 설정값만 `VARO` 기준으로 반영한다.
