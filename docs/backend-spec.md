# VARO Backend Spec

## 1. 문서 목적

이 문서는 VARO 서비스 전체의 백엔드 구조를 정의한다.  
대상은 NestJS 기반 API, 비동기 worker, 외부 연동, 공통 에러 처리, env 정책, 서비스 도메인별 서버 책임이다.

## 2. 백엔드 기술 스택

- Framework: NestJS
- Language: TypeScript
- API style: REST
- API 문서: Swagger / OpenAPI
- Primary DB: PostgreSQL
- Queue / Cache: Redis
- External Auth: Google login
- External Providers:
  - NAVER Search API
  - OpenAI Responses API Structured Outputs

## 3. 서비스 모듈 구조

### 3.1 Auth / Session

- Google OAuth 로그인 처리
- 세션 생성 / 검증 / 만료
- 보호 API 접근 제어

### 3.2 Users / Profile

- 사용자 기본 정보 관리
- 공개 프로필과 수정 가능 프로필 필드 관리

### 3.3 Reviews / Evidence

- claim 접수
- source 검색과 수집
- evidence snippet 생성
- verdict / interpretation / uncertainty 생성
- review 상태 조회

### 3.4 Community

- 게시글
- 댓글
- 반응
- 공개 프로필 기반 작성자 정보 노출

### 3.5 Popular / Ranking

- 인기 질문 집계
- 랭킹 스냅샷 생성
- 결과 재진입용 포인트 제공

### 3.6 Notifications

- 분석 완료 알림
- 커뮤니티 활동 알림
- 읽음 상태 관리

### 3.7 History

- 사용자별 분석 이력 저장
- 재진입과 상태 재확인 지원

### 3.8 Shared Infra

- env / secret 로딩
- queue
- trace id
- observability
- error mapping

## 4. 핵심 서버 원칙

- review 도메인은 AGENTS와 PRD의 근거 중심 원칙을 유지한다.
- 서비스 전체는 인증, 분석, 커뮤니티, 알림, 히스토리를 하나의 계정 체계로 묶는다.
- 비동기 처리가 필요한 영역은 queue와 worker로 분리한다.
- API는 도메인 책임 기준으로 나누고, 외부 provider 호출은 서비스 레이어 또는 worker에 캡슐화한다.

## 5. 인증 / 세션 구조

### 5.1 로그인 방식

- Google 로그인만 지원
- 이메일 자체 회원가입은 기본 범위에서 제외

### 5.2 세션 처리

- 로그인 성공 시 서버 세션 또는 동등한 secure session model 생성
- 세션은 `HttpOnly`, `SameSite=Lax` 쿠키로 유지
- `prod`에서만 `Secure=true` 적용
- 세션 TTL은 기본 30일 고정
- 보호 API는 세션 검증 이후에만 접근 허용
- 세션 만료 시 재인증 필요

### 5.3 권한 원칙

- review 생성, history, community 작성, notifications 조회는 인증 사용자 기준
- 커뮤니티는 익명 허용 없음
- 사용자 정보 수정은 허용된 필드만 가능

### 5.4 첫 로그인 프로필 보완

- Google 로그인 성공 직후 필수 프로필이 비어 있으면 프로필 보완 화면으로 이동
- 첫 로그인에서는 `real_name`, `gender`, `age_range`, `country`, `city`를 모두 입력해야 함
- `real_name`, `gender`, `age_range`는 최초 1회만 설정 가능
- 이후 수정 가능 필드는 `country`, `city`만 허용

## 6. review & evidence 파이프라인

### 6.1 단계

1. claim 접수
2. source 검색
3. 본문 추출
4. evidence 정리
5. interpretation 생성
6. 결과 저장
7. 완료 알림 생성
8. history 반영
9. 인기 집계 이벤트 발행

### 6.2 상태값

- `queued`
- `searching`
- `extracting`
- `analyzing`
- `completed`
- `partial`
- `failed`

### 6.3 review 원칙

- 결과는 `claim`, `evidence`, `interpretation`, `uncertainty`를 분리한다.
- verdict는 기사 수가 아니라 evidence 구조를 바탕으로 계산한다.
- 동일 오보 재인용은 dedup 대상이다.
- source와 snippet까지 추적 가능해야 한다.

### 6.4 worker 책임

- search provider 호출
- source fetch / 추출
- evidence 생성
- OpenAI structured interpretation 호출
- retry / timeout 처리
- result 저장

## 7. 서비스 이벤트와 비동기 처리

### 7.1 review 완료 이벤트

생성 시 후속 처리:

- 사용자 history 반영
- 분석 완료 알림 생성
- 인기 질문 집계 입력 반영

### 7.2 community 이벤트

생성 시 후속 처리:

- 댓글 생성 알림
- 반응 알림
- unread count 업데이트

### 7.3 ranking 집계

- 주기적 snapshot 또는 이벤트 기반 카운팅
- 홈 / 인기 화면에서 읽기 최적화된 형태로 제공

## 8. API 구조

### 8.1 API 원칙

- REST API 우선
- prefix는 `/api/v1`
- 도메인별 controller를 분리
- 클라이언트가 내부 worker 구조를 알 필요 없도록 상태 기반 응답을 제공

### 8.2 대표 엔드포인트 범주

#### Auth / Session

- 로그인 시작 / 콜백
- 현재 세션 조회
- 로그아웃

#### Users / Profile

- 현재 사용자 조회
- 사용자 정보 조회
- 프로필 수정

### 8.3 API 문서화 원칙

- Swagger 경로는 `/api/docs`
- Swagger UI는 `APP_ENV=dev`에서만 노출
- 제목, 설명, DTO 필드 설명, 응답 예시는 모두 한국어로 작성
- 보호 API는 cookie session 인증 필요 여부를 명시
- 에러 응답 예시에는 도메인 에러 코드와 한국어 설명을 포함

#### Reviews

- review 생성
- review 상태 / 결과 조회
- source 목록 조회
- retry

#### Community

- 게시글 목록 / 상세
- 게시글 생성
- 댓글 생성
- 반응 생성

#### Popular

- 인기 질문 목록 조회
- 인기 항목 기반 결과 재진입

#### Notifications

- 알림 목록 조회
- 읽음 처리
- unread count 조회

#### History

- 내 분석 이력 조회
- 기존 결과 재진입

## 9. 핵심 인터페이스 / 타입

### 9.1 Identity

- `User`
- `UserProfile`
- `Session`
- `AuthProvider`

### 9.2 Review

- `CreateReviewRequest`
- `ReviewJob`
- `ReviewResult`
- `SourceCard`
- `EvidenceSnippet`

### 9.3 Community

- `CommunityPost`
- `CommunityComment`
- `CommunityReaction`

### 9.4 Notifications

- `Notification`
- `NotificationReadState`

### 9.5 Popular / History

- `PopularTopic`
- `HistoryItem`

### 9.6 Shared

- `ApiError`
- `AppEnv`
- `ExternalProviderMode`

## 10. 외부 서비스 연동

### 10.1 Google 로그인

- 인증 provider
- 세션 발급의 시작점
- Google Cloud Console의 Authorized redirect URI는 `API_BASE_URL + /api/v1/auth/google/callback` 규칙으로 등록한다.
- 로컬 예시는 `API_BASE_URL=http://localhost:4000` 이고 redirect URI는 `http://localhost:4000/api/v1/auth/google/callback` 이다.
- Authorized JavaScript origins와 Authorized redirect URIs는 별개다. origin만 등록하고 redirect URI를 누락하면 `redirect_uri_mismatch`가 발생한다.
- OAuth 콜백은 백엔드가 처리하지만, 콜백 완료 후 최종 화면 이동은 `FRONTEND_BASE_URL` 기준 절대 URL로 리다이렉트한다.

### 10.2 NAVER Search API

- review 도메인의 source 후보 수집
- `dev`에서는 mock 가능
- `prod`에서는 실제 provider 사용

### 10.3 OpenAI Responses API

- review 도메인의 structured interpretation 생성
- 입력에 없는 사실을 생성하지 않도록 제한
- `dev`에서는 mock 가능
- `prod`에서는 실제 provider 사용

### 10.4 Source Fetch

- source 원문 HTML 수집
- timeout / redirect / extraction 처리
- provider API가 아닌 직접 URL fetch 계층

## 11. 에러 처리

### 11.1 공통 원칙

- HTTP 상태코드보다 도메인 에러 코드를 먼저 본다.
- 사용자 노출 문구와 내부 운영 메시지를 분리한다.
- trace id를 항상 함께 남긴다.

### 11.2 대표 도메인 에러

- `INPUT_VALIDATION_ERROR`
- `AUTH_REQUIRED`
- `FORBIDDEN`
- `SOURCE_SEARCH_FAILED`
- `SOURCE_FETCH_TIMEOUT`
- `EXTRACTION_FAILED`
- `LLM_SCHEMA_ERROR`
- `CONFIG_VALIDATION_ERROR`
- `REVIEW_PARTIAL`
- `INTERNAL_ERROR`

### 11.3 review 도메인 규칙

- `partial`은 정상 응답 본문 내 상태값으로 표현한다.
- 근거 부족은 결과 내부의 `uncertainty`와 도메인 상태로 드러낸다.

## 12. 보안 / env / 운영

### 12.1 env 원칙

- 지원 환경은 `dev`, `prod`
- API shape와 DB schema 구조는 환경 간 동일
- 비밀값은 env 또는 secret store로만 주입
- `NEXT_PUBLIC_*`에는 비밀값 금지

### 12.2 필수 env 축

- `APP_NAME`
- `APP_TAGLINE`
- `APP_PUBLIC_URL`
- `APP_INTENDED_PRODUCTION_HOST`
- `APP_CANONICAL_HOST_STATUS`
- `NODE_ENV`
- `APP_ENV`
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `API_BASE_URL`
- `FRONTEND_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_DAYS`
- `OPENAI_API_KEY`
- `NAVER_SEARCH_CLIENT_ID`
- `NAVER_SEARCH_CLIENT_SECRET`

### 12.3 dev / prod 정책

- `dev`는 mock search / mock llm 허용
- `prod`는 실제 provider만 허용
- `prod`에서 필수 env 누락 시 부팅 실패

### 12.4 observability

- trace id 발급
- `environment=dev|prod` 태그 유지
- review 완료율 / partial 비율 / 외부 provider 실패율 관측
- 알림 생성 성공률, ranking 집계 지연, community mutation 실패율 관측

## 13. review 도메인 특별 원칙

review 도메인은 서비스 전체 안의 하나의 핵심 서브시스템이지만, 아래 원칙은 강하게 유지한다.

- 진실 기계처럼 행동하지 않는다.
- 수집된 출처 기준 해석만 제공한다.
- `claim`, `evidence`, `interpretation`, `uncertainty`를 분리한다.
- 사용자가 원문을 열람할 수 있게 한다.
- 상충하는 근거와 부족한 근거를 숨기지 않는다.
