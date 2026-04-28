# VARO Frontend Spec

## 1. 문서 목적

이 문서는 현재 VARO 프론트엔드 구현을 기준으로 기술 구조와 사용자 경험 범위를 정리한다.  
핵심 대상은 모바일 웹 우선의 반응형 Next.js 애플리케이션이며, 인증, review preview, 인기, 커뮤니티, 히스토리, 서버 알림 흐름을 하나의 앱 셸 안에서 연결하는 방식을 설명한다.

## 2. 프론트엔드 기술 스택

- Framework: Next.js 16
- UI Runtime: React 19
- Language: TypeScript
- Routing: App Router
- Styling: Tailwind CSS 4
- Rendering strategy:
  - 인증 게이트와 보호 레이아웃은 서버 렌더링 우선
  - 상호작용이 많은 화면은 클라이언트 컴포넌트 사용

## 3. 프론트엔드 역할

- 로그인 상태와 프로필 완성 여부 기반 진입 제어
- 서비스 공통 레이아웃과 내비게이션 제공
- review preview 생성, loading 상태 표시, detail 렌더링
- 인기 주제, 커뮤니티, 히스토리, 알림 UI 제공
- 사용자 프로필 조회 및 일부 수정 UI 제공
- badge, unread, loading, error, empty state를 일관된 방식으로 관리

프론트엔드는 verdict 계산, source 해석, 인기 집계 계산 같은 서버 책임을 직접 수행하지 않는다. 다만 현재 구현에서는 review task와 notification 일부 상태를 클라이언트 localStorage에 보조 저장한다.

## 4. 앱 셸 구조

### 4.1 공통 레이아웃

- 상단 바
  - 좌측 햄버거 메뉴
  - 우측 알림 버튼
- 하단 네비게이션
  - Home
  - Popular
  - Community
- 보호 영역
  - 로그인 이후 접근 가능한 화면

### 4.2 auth gate

- 서버 컴포넌트에서 `/api/v1/auth/session`을 호출해 세션을 확인
- 비로그인 사용자는 `/login`으로 이동
- 로그인했지만 프로필 미완성 사용자는 `/onboarding/profile`로 이동
- 인증과 프로필 조건을 만족한 뒤 서비스 공통 앱 셸을 렌더링
- 세션 만료 시 재인증 흐름으로 전환

### 4.3 햄버거 메뉴

- History
- Settings
- Settings 내부에서 User Info 진입
- 최근 review preview 요약 리스트

## 5. 주요 화면군

### 5.1 Login

- Google 로그인 버튼 단일 CTA
- 서비스 소개와 신뢰감 중심 카피
- 비로그인 사용자 진입점

### 5.2 Onboarding Profile

- 첫 로그인 후 필수 프로필 입력
- 실명, 성별, 나이대, 국가, 도시 저장
- 저장 완료 후 Home 이동

### 5.3 Home

- 중앙 입력 영역
- 분석 시작 CTA
- active review task 감지 시 `/loading` 복귀
- 간결한 서비스 소개 카피

### 5.4 Analysis Loading

- 전역 review task store 기반 진행 상태
- 안내용 단계 메시지
- 실패 시 재시도 / 홈 이동
- 완료 시 결과 보기
- 완료 알림 기대 형성

### 5.5 Analysis Result

- claim
- provisional verdict / confidence / 수집된 출처 간 일치도
- 수집 뉴스 종합 요약 / 공식 출처 확인 상태
- source distribution / agreement / conflict summary
- evidence snippet list. 현재 preview 경로에서는 snippet row가 없을 수 있으므로 source raw snippet과 evidence signal을 중심으로 표시한다.
- source card 목록
- source type filter
- 기본 숨김 query context / search plan
- uncertainty / insufficiency 안내

현재 결과 화면은 최종 interpretation 저장 결과가 아니라, 저장된 preview artifact를 바탕으로 서버가 계산한 `rule_based_preview` 상세 결과를 보여준다.

### 5.6 Popular

- 인기 질문 랭킹
- 순위 / 질문 요약 / 요청 수 / 재열람 수 / 합산 점수
- 대표 review preview 재진입

### 5.7 Community

- 게시글 목록
- 게시글 상세
- 게시글 작성 / 수정 / 삭제
- 댓글 / 대댓글 작성
- 댓글 삭제
- 게시글 좋아요 / 댓글 좋아요
- 작성자 공개 정보

### 5.8 History

- 사용자의 이전 질문 / 분석 기록
- 일시 / 상태 / 재진입 액션
- history 재진입은 meaningful reopen source로 기록
- 서버 응답과 local pending task를 병합해 렌더링

### 5.9 User Info / Settings

- 사용자 정보 조회
- 일부 프로필 수정
- 읽기 전용과 수정 가능 항목 구분
- Settings는 `내 정보 관리`, `개인정보 보호`, `알림 설정`, `고객 센터` 진입을 제공
- 개인정보 보호와 고객 센터는 정보형 서브페이지로 제공
- 알림 설정은 서버 저장 기반 토글 UI를 제공
- review 완료, community 댓글, community 좋아요 알림이 모두 실제 서버 생성 흐름에 연결된다

### 5.10 Notifications

- review preview 완료 알림
- community 댓글 / 좋아요 알림
- 읽음 / 미확인 상태
- review 알림 클릭은 meaningful reopen source로 기록
- 커뮤니티 알림 클릭은 관련 게시글 상세로 이동한다

## 6. 클라이언트 상태 모델

### 6.1 공통 상태 축

- `auth/session`
- `layout/navigation`
- `notifications/unread`
- `history/list`
- `community/feed`
- `popular/ranking`
- `review/tasks`

### 6.2 review 상태

- 클라이언트 task 상태
  - `pending`
  - `submitting`
  - `succeeded`
  - `failed`
- preview 응답 상태
  - `searching`
  - `partial`
  - `completed`
  - `failed`

### 6.3 notification 상태

- `idle`
- `loading`
- `ready`
- `empty`
- `error`

저장 위치:

- 서버 `notifications`: 알림 목록과 대상 정보
- 서버 `notification_reads`: 읽음 상태
- 서버 `user_notification_preferences`: 알림 수신 토글 설정

### 6.4 community 상태

- `list-loading`
- `list-ready`
- `detail-ready`
- `mutation-pending`
- `empty`
- `error`

추가 보조 상태:

- `varo.review-tasks`: pending draft, reviewId 승격, 오류 메시지, 알림 생성 여부 저장
- history 화면은 서버 응답과 local pending task 요약을 병합해 렌더링

## 7. 라우팅 원칙

대표 route 그룹은 아래와 같다.

- `/login`
- `/onboarding/profile`
- `/`
- `/loading`
- `/reviews/[reviewId]`
- `/popular`
- `/community`
- `/community/write`
- `/community/[postId]`
- `/community/[postId]/edit`
- `/history`
- `/settings`
- `/user-info`
- `/notifications`

원칙:

- 보호 화면은 세션 검증 이후 렌더링
- 결과 페이지는 deep link로 재진입 가능해야 함
- 결과 재진입은 선택적 `entry` query를 통해 source를 전달할 수 있어야 함
- `entry` 값은 `popular | history | notification`만 허용
- 해당 query가 있으면 프론트는 review reopen API를 호출한 뒤 URL에서 query를 제거
- 알림 클릭은 관련 화면으로 직접 이동해야 함

## 8. API 소비 방식

### 8.1 인증 관련

- `GET /api/v1/auth/session`
- `POST /api/v1/auth/logout`
- 로그인 완료 후 사용자 상태 동기화
- 보호 API 호출 전 인증 상태 확인

### 8.2 사용자 프로필 관련

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/profile`

### 8.3 review 관련

- `POST /api/v1/reviews/query-processing-preview`
- `GET /api/v1/reviews`
- `GET /api/v1/reviews/{reviewId}`
- `POST /api/v1/reviews/{reviewId}/reopen`

`POST /api/v1/reviews/query-processing-preview`는 현재 최종 완료까지 오래 걸리는 비동기 job id만 반환하지 않고, 백엔드가 동기적으로 preview pipeline을 실행한 뒤 detail을 반환한다. 프론트의 loading 단계 메시지는 실제 backend stage polling이 아니라 local task store 기반 안내용 진행 상태다.

### 8.4 서비스 기능 관련

- `GET /api/v1/popular/topics`
- `GET /api/v1/community/posts`
- `GET /api/v1/community/posts/{postId}`
- `POST /api/v1/community/posts`
- `PATCH /api/v1/community/posts/{postId}`
- `DELETE /api/v1/community/posts/{postId}`
- `POST /api/v1/community/posts/{postId}/comments`
- `DELETE /api/v1/community/posts/{postId}/comments/{commentId}`
- `POST /api/v1/community/posts/{postId}/likes`
- `DELETE /api/v1/community/posts/{postId}/likes`
- `POST /api/v1/community/posts/{postId}/comments/{commentId}/likes`
- `DELETE /api/v1/community/posts/{postId}/comments/{commentId}/likes`

프론트는 도메인별 API client 계층을 통해 서버와 통신하고, 화면 컴포넌트가 HTTP 세부사항을 직접 다루지 않도록 유지한다. notifications도 동일하게 서버 API를 소비한다.

## 9. review 화면 정보 구조

review 도메인은 AGENTS와 PRD 원칙을 그대로 따른다.

표시 순서:

1. claim
2. provisional verdict / confidence / 수집된 출처 간 일치도
3. rule-based 수집 뉴스 종합 요약과 공식 출처 확인 상태
4. evidence snippet 또는 source raw snippet 기반 근거
5. source card 목록
6. 기본 숨김 query context와 search plan
7. uncertainty / insufficiency 안내

표시 원칙:

- 현재 화면은 최종 저장 verdict가 아니라 `rule_based_preview` 임시 결과임을 숨기지 않는다.
- evidence가 interpretation / verdict보다 먼저 보여야 한다.
- consensus는 사실 확률이 아니라 수집된 출처 간 일치도 성격으로 표현한다.
- 최신 출처 기준, 상충/업데이트 신호, 근거 부족은 가능한 경우 별도 UI 개념으로 분리한다.
- source card에는 출처명, 발행 시각, source type, snippet, 링크를 포함한다.
- interpretation과 최종 verdict는 아직 생성 전 단계이며, 현재 결과는 저장된 preview artifact 기준 파생 결과임을 명시한다.
- uncertainty 또는 insufficiency는 별도 블록으로 분리한다.
- `partial` 결과는 경고와 함께 표시한다.

## 10. 커뮤니티와 계정 관련 표시 원칙

- 커뮤니티는 익명 사용을 허용하지 않는다.
- 작성자 정보는 실명, 성별, 나이대 기준으로 노출된다.
- 사용자 정보 화면에서는 수정 가능 항목과 읽기 전용 항목을 명확히 구분한다.
- Settings의 일부 메뉴는 placeholder 상태임을 숨기지 않는다.
- 알림은 단순 표시가 아니라 관련 화면으로 이동 가능한 행동 단위여야 한다.

## 11. 공개 env

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_TAGLINE`
- `NEXT_PUBLIC_APP_PUBLIC_URL`
- `NEXT_PUBLIC_APP_INTENDED_PRODUCTION_HOST`
- `NEXT_PUBLIC_APP_CANONICAL_HOST_STATUS`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_ENV`

원칙:

- 지원 환경은 `dev`, `prod` 두 개다.
- API shape는 환경 간 동일하다.
- 비밀값은 프론트 env에 두지 않는다.
- 앱 메타데이터와 브랜드 문구는 `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_TAGLINE`을 우선 사용한다.

## 12. UX 기술 원칙

- 근거 중심
- 차분한 톤
- 과장 없는 카피
- 모바일 우선 반응형
- unread, loading, empty, error 상태를 누락하지 않음
- review 도메인에서는 결론보다 근거를 먼저 이해하게 함
- 현재 구현이 preview artifact 기반 임시 result 중심이라는 사실을 UI 문구와 문서에서 일관되게 유지함
