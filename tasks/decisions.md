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
- 기본 브랜드 casing은 예외 없이 `VARO`로 고정한다.
- 사용자 노출 표기는 `VARO`로 고정한다.
- `Verified Analysis, Reasoned Opinion`은 `VARO`의 기본 확장형 설명이자 사용자-facing 태그라인으로 사용한다.
- 로고 이미지 파일 자체 교체는 후속 작업으로 남기고, 이번 단계에서는 텍스트와 설정값만 `VARO` 기준으로 반영한다.

### 도메인 기준선
- `www.varocheck.com`은 예정된 production host로 기록한다.
- canonical host 상태는 도메인 연결 전까지 `pending`으로 유지한다.
- 실제 배포 연결 전에는 canonical tag, live redirect, OAuth callback URL, sitemap host, CORS production origin을 `www.varocheck.com`으로 고정하지 않는다.
- 위 항목은 모두 config를 통해 준비하고, 실제 도메인 연결 시점에만 활성화한다.

## 2026-04-01

### Review Query Processing
- review query processing 1차 구현 범위는 `claim intake ~ evidence preparation`까지로 제한한다.
- review query backend의 1차 공개 API는 `POST /api/v1/reviews/query-processing-preview`로 둔다.
- query refinement와 relevance filtering의 출력 모델은 `primary / reference / discard` 3단계로 고정한다.
- source traceability는 source별 `origin_query_ids[]`를 유지하는 방식으로 구현한다.
- dev 환경의 review provider mode 기본값은 `mock`, prod 기본값은 `real`로 둔다.
- 1차 extraction 대상은 `primary` 우선, 부족 시 `reference` 제한 승격으로 처리한다.
- real provider 조합은 Tavily search/extract + OpenAI structured outputs로 고정한다.
- query refinement와 relevance filtering의 OpenAI 모델은 모두 `gpt-5-mini`로 고정한다.
- 인증 endpoint와 dev 테스트 endpoint는 같은 provider service 경로를 공유한다.
- `real` 모드에서는 API key 누락이나 provider 실패를 mock으로 숨기지 않고 명시적으로 실패시킨다.
- `languageCode`는 claim 엔터티에 저장하지 않고, query refinement artifact와 preview API 응답에서만 유지한다.

### Country-Aware Domain Routing
- review query processing은 언어와 별도로 `topicCountryCode` / `topicScope`를 LLM이 판정한다.
- 국가별 trusted domain registry를 DB로 관리하고, Tavily `include_domains`로 familiar / verification pass를 분리한다.
- 한국 사용자에게는 한국 familiar domain을 우선 제공하되, 해외 이슈에서는 verification source 확보를 우선한다.
- retrieval bucket은 `familiar / verification / fallback` 3단계로 고정한다.
- 국가별 domain registry는 MVP에서 소수 핵심 도메인만 큐레이션한다.

## 2026-04-02

### Reviews Preview Integration
- `/reviews/[reviewId]`는 최종 verdict 화면이 아니라 `query-processing-preview` 결과를 보여주는 evidence-first preview 화면으로 연결한다.
- interpretation과 verdict가 아직 생성되지 않은 단계는 UI에서 명시적으로 안내한다.
- preview 연동용 읽기 API는 `GET /api/v1/reviews`, `GET /api/v1/reviews/:reviewId`로 둔다.
- `POST /api/v1/reviews/query-processing-preview`와 `GET /api/v1/reviews/:reviewId`는 같은 preview detail 계약을 공유한다.
- review preview detail 계약에는 `rawClaim`, `createdAt`, source `originalUrl`, source `publishedAt`을 포함한다.
- history drawer는 verdict 대신 `status/currentStage` 기반 상태 라벨을 노출한다.

### Frontend Review Task Flow
- review preview 생성 요청의 소유권은 `loading` 페이지가 아니라 프론트 전역 review task store가 가진다.
- active review task가 진행 중이면 `Home` 진입 시 입력 화면 대신 기존 `/loading`으로 복귀시켜 중복 요청을 막는다.
- history는 `claim + 시간` 휴리스틱 대신 `draftId -> reviewId` 승격 방식으로 중복 없이 병합한다.
- review completion 알림은 `loading` 화면이 아니라 review task 성공 전이에서 1회 생성한다.
