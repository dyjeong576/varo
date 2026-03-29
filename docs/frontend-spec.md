# VARO Frontend Spec

## 1. 문서 목적

이 문서는 VARO 서비스 전체의 프론트엔드 기술 구조를 정의한다.  
핵심 대상은 모바일 웹 우선의 반응형 Next.js 애플리케이션이며, 인증, 분석, 인기, 커뮤니티, 알림, 히스토리를 하나의 앱 셸 안에서 연결하는 방식을 설명한다.

## 2. 프론트엔드 기술 스택

- Framework: Next.js
- Language: TypeScript
- Routing: App Router
- Styling: Tailwind CSS
- Rendering strategy:
  - 앱 셸과 인증 게이트는 서버 렌더링 우선
  - 상호작용이 많은 영역은 클라이언트 컴포넌트 사용

## 3. 프론트엔드 역할

- 로그인 상태 기반 진입 제어
- 서비스 공통 레이아웃과 내비게이션 제공
- review 생성, 진행 상태 polling, 결과 렌더링
- 인기 질문, 커뮤니티, 히스토리, 알림 UI 제공
- 사용자 프로필 조회 및 일부 수정 UI 제공
- badge, unread, loading, error, empty state를 일관된 방식으로 관리

프론트엔드는 verdict 계산, source 해석, 인기 집계 계산, 알림 생성 같은 서버 책임을 직접 수행하지 않는다.

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

- 비로그인 사용자는 로그인 화면으로 이동
- 로그인 이후 서비스 공통 앱 셸 렌더링
- 세션 만료 시 재인증 흐름으로 전환

### 4.3 햄버거 메뉴

- History
- Settings
- User Info 진입

## 5. 주요 화면군

### 5.1 Login

- Google 로그인 버튼 단일 CTA
- 서비스 소개와 신뢰감 중심 카피
- 비로그인 사용자 진입점

### 5.2 Home

- 중앙 입력 영역
- 분석 시작 CTA
- 최근 작업 또는 안내 상태를 위한 최소 보조 정보

### 5.3 Analysis Loading

- 단계별 진행 상태
- 진행 메시지
- 장시간 처리 시 알림 기대 형성

### 5.4 Analysis Result

- claim
- evidence 요약
- source card 목록
- interpretation
- uncertainty
- verdict

### 5.5 Popular

- 인기 질문 랭킹
- 순위 / 질문 요약 / 관련 수치
- 결과 또는 주제 상세 재진입

### 5.6 Community

- 게시글 목록
- 게시글 상세
- 댓글
- 반응
- 작성자 공개 정보

### 5.7 History

- 사용자의 이전 질문 / 분석 기록
- 일시 / 상태 / 재진입 액션

### 5.8 User Info / Settings

- 사용자 정보 조회
- 일부 프로필 수정
- 읽기 전용과 수정 가능 항목 구분

### 5.9 Notifications

- 분석 완료 알림
- 커뮤니티 관련 알림
- 읽음 / 미확인 상태

## 6. 클라이언트 상태 모델

### 6.1 공통 상태 축

- `auth/session`
- `layout/navigation`
- `notifications/unread`
- `history/list`
- `community/feed`
- `popular/ranking`
- `review/current`

### 6.2 review 상태

- `idle`
- `submitting`
- `loading`
- `completed`
- `partial`
- `error`

### 6.3 notification 상태

- `idle`
- `loading`
- `ready`
- `empty`
- `error`

### 6.4 community 상태

- `list-loading`
- `list-ready`
- `detail-ready`
- `mutation-pending`
- `empty`
- `error`

## 7. 라우팅 원칙

대표 route 그룹은 아래와 같다.

- `/login`
- `/`
- `/reviews/[reviewId]`
- `/popular`
- `/community`
- `/community/[postId]`
- `/history`
- `/settings`
- `/user-info`
- `/notifications`

원칙:

- 보호 화면은 세션 검증 이후 렌더링
- 결과 페이지는 deep link로 재진입 가능해야 함
- 알림 클릭은 관련 화면으로 직접 이동해야 함

## 8. API 소비 방식

### 8.1 인증 관련

- 세션 확인
- 로그인 완료 후 사용자 상태 동기화
- 보호 API 호출 전 인증 상태 확인

### 8.2 review 관련

- `POST /api/v1/reviews`
- `GET /api/v1/reviews/{reviewId}`
- `GET /api/v1/reviews/{reviewId}/sources`
- 선택 구현: `POST /api/v1/reviews/{reviewId}/retry`

### 8.3 서비스 기능 관련

- 인기 질문 목록 조회
- 커뮤니티 목록 / 상세 / 생성 / 댓글 / 반응
- 알림 목록 / 읽음 처리
- 히스토리 조회
- 사용자 정보 조회 / 수정

프론트는 도메인별 API client 계층을 통해 서버와 통신하고, 화면 컴포넌트가 HTTP 세부사항을 직접 다루지 않도록 유지한다.

## 9. review 화면 정보 구조

review 도메인은 AGENTS와 PRD 원칙을 그대로 따른다.

표시 순서:

1. claim
2. evidence 요약과 핵심 snippet
3. source card 목록
4. interpretation
5. uncertainty
6. verdict

표시 원칙:

- evidence가 verdict보다 먼저 보여야 한다.
- source card에는 출처명, 발행 시각, source type, snippet, 링크를 포함한다.
- verdict는 단정적 진실 선언처럼 보이면 안 된다.
- uncertainty는 별도 블록으로 분리한다.
- `partial` 결과는 경고와 함께 표시한다.

## 10. 커뮤니티와 계정 관련 표시 원칙

- 커뮤니티는 익명 사용을 허용하지 않는다.
- 작성자 정보는 실명, 성별, 나이대 기준으로 노출된다.
- 사용자 정보 화면에서는 수정 가능 항목과 읽기 전용 항목을 명확히 구분한다.
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
