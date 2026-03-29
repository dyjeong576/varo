# VARO Architecture Overview

## 1. 문서 목적
이 문서는 VARO 서비스 전체의 핵심 기술 구조를 설명하는 루트 문서다.  
기준 문서는 아래 3개다.

- [AGENTS.md](../AGENTS.md)
- [PRD](./prd.md)
- [Product Spec](./product-spec.md)

이 문서는 기능별 상세 요구사항이 아니라, 서비스 전반을 지탱하는 기술 축과 시스템 경계를 정의한다.

## 2. 서비스 기술 원칙

### 2.1 근거 중심 원칙
- VARO는 절대적 진실 판정기가 아니다.
- review 도메인의 결과는 항상 `claim`, `evidence`, `interpretation`, `uncertainty`를 분리한다.
- 기사 수만으로 결론을 내리지 않고, 출처 추적 가능성을 유지한다.
- 사용자가 근거를 직접 열람할 수 있어야 한다.

### 2.2 서비스 전체 원칙
- 모바일 웹 우선의 반응형 애플리케이션으로 설계한다.
- 인증, 분석, 인기, 커뮤니티, 알림, 히스토리를 하나의 서비스 안에서 일관된 계정과 데이터 모델로 연결한다.
- 공통 보안, 공통 상태 관리, 공통 관측 체계를 우선한다.
- 기능 스펙과 구현 세부는 별도 문서로 분리하되, 기술 문서는 서비스 공통 구조를 기준으로 유지한다.

## 3. 기술 스택
- Frontend: Next.js, TypeScript, App Router, Tailwind CSS
- Backend API: NestJS, TypeScript, REST API
- Worker / Async Processing: Node.js worker + Redis queue
- Primary Database: PostgreSQL
- External Auth: Google login
- External Search / AI:
  - NAVER Search API
  - OpenAI Responses API Structured Outputs

## 4. 서비스 도메인 구조
VARO는 아래 도메인으로 구성한다.

### 4.1 Identity & Access
- Google 로그인
- 세션 관리
- 인증 게이트
- 사용자 프로필

### 4.2 Review & Evidence Pipeline
- claim 입력
- source 검색 및 수집
- evidence snippet 생성
- verdict / interpretation / uncertainty 생성
- 결과 페이지 렌더링

### 4.3 Community & Participation
- 게시글
- 댓글
- 반응
- 공개 사용자 정보 기반 토론

### 4.4 Popular & Ranking
- 인기 질문 집계
- 랭킹 스냅샷
- 결과 또는 주제 재진입

### 4.5 Notifications
- 분석 완료 알림
- 커뮤니티 활동 알림
- 읽음 상태 관리

### 4.6 User History & Profile
- 이전 분석 기록
- 결과 재진입
- 사용자 정보 조회 / 일부 수정

### 4.7 Shared Platform
- 공통 API 계층
- 공통 데이터 모델
- queue / event 처리
- env / secret 관리
- observability / error tracking

## 5. 전체 시스템 구조

```text
[User Browser]
    |
    v
[Next.js Frontend App]
    |
    v
[NestJS API]
    |-- auth/session ----------> [Google Auth]
    |-- read/write ------------> [PostgreSQL]
    |-- enqueue events/jobs ---> [Redis]
    |
    +--> [Workers]
           |-- review pipeline --> [NAVER Search API]
           |-- interpretation ---> [OpenAI Responses API]
           |-- notification jobs
           |-- ranking aggregation
           +-- persist ----------> [PostgreSQL]
```

핵심 구조:

- 프론트엔드는 서비스 전체 앱 셸과 사용자 인터랙션을 담당한다.
- 백엔드는 도메인 API와 공통 비즈니스 규칙을 담당한다.
- worker는 review 분석, 알림 생성, 인기 집계 같은 비동기 작업을 담당한다.
- PostgreSQL은 서비스 전반의 기준 데이터 저장소다.
- Redis는 queue와 일시적 비동기 제어를 담당한다.

## 6. 프론트 / 백엔드 / 데이터 경계

### 6.1 Frontend
- 로그인 상태 확인
- 서비스 라우팅
- review 생성과 결과 조회
- 인기 / 커뮤니티 / 히스토리 / 알림 UI 렌더링
- unread badge, loading state, optimistic interaction 처리

### 6.2 Backend API
- 인증 세션 검증
- 도메인별 REST API 제공
- 권한 검사
- 동기 요청 처리
- job enqueue 및 상태 관리

### 6.3 Workers
- review 분석 파이프라인 실행
- 알림 fan-out / 읽음 처리 보조
- 인기 집계 스냅샷 생성
- 외부 provider 호출과 retry

### 6.4 Data Layer
- 사용자 / 세션 / 프로필
- review / evidence / result
- community
- notifications
- history
- popular snapshot

## 7. 환경 구성
지원 환경은 `dev`, `prod` 두 개다.

- `dev`와 `prod`는 각각 독립 배포 단위다.
- 환경 간 DB, Redis, 시크릿, 도메인, 배포 리소스를 공유하지 않는다.
- API shape와 DB 스키마 구조는 환경 간 동일하게 유지한다.
- `dev`는 mock 외부 연동을 기본 허용한다.
- `prod`는 실제 provider만 허용한다.

환경 타입:

- `AppEnv = "dev" | "prod"`
- `ExternalProviderMode = "mock" | "real"`

## 8. 보안과 운영

### 8.1 보안
- 비밀값은 env 또는 secret store로만 주입한다.
- `NEXT_PUBLIC_*`에는 비밀값을 넣지 않는다.
- 인증되지 않은 사용자는 보호된 화면과 API에 접근할 수 없다.
- 커뮤니티는 익명 사용을 허용하지 않는다.
- review 결과는 원문 출처 링크와 함께 제공되어야 한다.

### 8.2 운영
- 모든 요청과 job에 trace id를 남긴다.
- `environment=dev|prod` 태그를 로그와 메트릭에 포함한다.
- 외부 API 실패율, review 완료율, 알림 생성 성공률, 인기 집계 지연을 관측한다.
- queue 적체와 외부 provider 장애는 서비스 품질에 직접 연결되는 운영 지표로 본다.

## 9. 문서 역할
- [Frontend Spec](./frontend-spec.md): 서비스 프론트엔드 구조와 클라이언트 상태
- [Backend Spec](./backend-spec.md): 서비스 백엔드 구조, API, 비동기 처리, env
- [Data Model](./data-model.md): 서비스 전체 저장 모델과 상태값
- [ERD](./erd.md): 서비스 전체 엔티티 관계와 데이터 흐름
