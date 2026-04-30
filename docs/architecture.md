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
- answer 도메인의 결과는 항상 `check`, `evidence`, `interpretation`, `uncertainty`를 분리한다.
- 기사 수만으로 결론을 내리지 않고, 출처 추적 가능성을 유지한다.
- 사용자가 근거를 직접 열람할 수 있어야 한다.

### 2.2 서비스 전체 원칙
- 모바일 웹 우선의 반응형 애플리케이션으로 설계한다.
- 인증, 분석, 인기, 커뮤니티, 알림, 히스토리를 하나의 서비스 안에서 일관된 계정과 데이터 모델로 연결한다.
- 공통 보안, 공통 상태 관리, 공통 관측 체계를 우선한다.
- 기능 스펙과 구현 세부는 별도 문서로 분리하되, 기술 문서는 서비스 공통 구조를 기준으로 유지한다.

## 3. 기술 스택
- Frontend: Next.js 16, React 19, TypeScript, App Router, Tailwind CSS 4
- Backend API: NestJS, TypeScript, REST API
- Worker / Async Processing: Node.js worker + Redis queue는 후속 확장 축이다. 현재 answer preview 생성은 API 요청 안에서 동기 처리한다.
- Primary Database: PostgreSQL
- Infra / Runtime: Amazon Linux EC2, Docker Compose, nginx container, certbot container, GHCR, GitHub Actions self-hosted runner
- External Auth: Google login
- External Search / AI:
  - Provider router for Naver News Search and Tavily Search fallback
  - OpenAI structured outputs

## 4. 서비스 도메인 구조
VARO는 아래 도메인으로 구성한다.

### 4.1 Identity & Access
- Google 로그인
- 세션 관리
- 인증 게이트
- 사용자 프로필

### 4.2 Answer & Evidence Pipeline
- check 입력
- source 검색 및 수집
- relevance, evidence signal, summary 통합 생성
- preview detail 생성
- 저장된 summary와 preview artifact 기반 verdict / interpretation / uncertainty 구성
- 결과 페이지 렌더링

### 4.3 Community & Participation
- 게시글
- 댓글
- 반응
- 공개 사용자 정보 기반 토론

### 4.4 Popular & Ranking
- 인기 질문 집계
- `submitted + meaningful reopen` 기반 랭킹
- 결과 또는 주제 재진입

### 4.5 Notifications
- 분석 완료 알림
- 커뮤니티 활동 알림
- 읽음 상태 관리

### 4.6 User History & Profile
- 이전 분석 기록
- 결과 재진입
- 사용자 정보 조회 / 일부 수정
- 첫 로그인 프로필 온보딩

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
    |-- server-side session gate --> [/api/v1/auth/session]
    |-- local persisted ui state --> [localStorage]
    |
    v
[NestJS API]
    |-- auth/session ----------> [Google Auth]
    |-- read/write ------------> [PostgreSQL]
    |-- answer preview pipeline -> [Naver News Search / Tavily Search fallback / OpenAI]
    |-- enqueue future jobs ----> [Redis]
    |
    +--> [Workers]
           |-- planned long-running answer jobs
           |-- planned source extraction / structured final interpretation
           |-- planned notification fan-out
           +-- persist ----------> [PostgreSQL]
```

핵심 구조:

- 프론트엔드는 서버 세션 확인 이후 보호 레이아웃을 렌더링한다.
- 프론트엔드는 answer preview, 인기, 커뮤니티, 히스토리, 알림 UI를 담당한다.
- 프론트엔드는 일부 UI 상태를 localStorage에 유지한다.
- 백엔드는 도메인 API와 공통 비즈니스 규칙을 담당한다.
- 현재 answer preview 생성은 NestJS API가 동기 처리한다.
- worker는 장기적 answer job, source extraction, 알림 fan-out 같은 후속 확장 책임으로 둔다.
- PostgreSQL은 서비스 전반의 기준 데이터 저장소다.
- Redis는 queue와 일시적 비동기 제어를 담당한다.

### 5.1 현재 production 배포 토폴로지

현재 production 인프라는 비용과 운영 단순성을 우선한 단일 서버 구성을 사용한다.

```text
[User Browser]
    |
    v
[Route 53]
    |
    v
[Amazon Linux EC2]
    |
    +--> [nginx container :80/:443]
    |       |-- www.varocheck.com --> [frontend container :3000]
    |       |-- api.varocheck.com --> [backend container :4000]
    |
    +--> [certbot container]
    |       |-- ACME webroot --> [/srv/varo/certbot/www]
    |       +-- cert storage --> [/srv/varo/certbot/conf]
    |
    +--> [postgres container]
    |
    +--> [self-hosted GitHub Actions runner]
            |
            +--> build and push images to [GHCR]
            +--> pull release images from [GHCR]
            +--> run [/srv/varo/compose/deploy.sh]
```

운영 기준:

- `nginx`, `certbot`, `frontend`, `backend`, `postgres`는 같은 EC2의 Docker Compose로 기동한다.
- 외부 공개 포트는 `80`, `443`, `22`만 사용한다.
- `3000`, `4000`, `5432`는 host에 bind 하지 않고 compose 내부 네트워크로만 사용한다.
- 로컬 PC에서 Postgres 접속이 필요할 때는 `5432` 공개 대신 SSH tunnel을 사용한다.
- 활성 Nginx 설정은 `/srv/varo/nginx/conf.d/*.conf`, 공통 include는 `/srv/varo/nginx/includes/*.conf`, 템플릿은 `/srv/varo/nginx/templates/*`에 둔다.
- certbot webroot와 인증서 저장소는 각각 `/srv/varo/certbot/www`, `/srv/varo/certbot/conf`를 사용한다.
- deploy bootstrap은 `postgres up -> http-only nginx -> cert issuance/renew -> tls reload -> app deploy` 순서를 따른다.
- host `nginx`는 컨테이너 구조로 전환하기 전에 수동으로 중지/비활성화한다.

## 6. 프론트 / 백엔드 / 데이터 경계

### 6.1 Frontend
- 로그인 상태 확인
- 서버 세션 기반 auth gate
- 서비스 라우팅
- answer preview 생성과 결과 조회
- 인기 / 커뮤니티 / 히스토리 / 알림 UI 렌더링
- unread badge, loading state, optimistic interaction 처리
- `varo.answer-tasks` localStorage 관리
- 서버 notifications API 기반 badge/list/read state 관리

### 6.2 Backend API
- 인증 세션 검증
- 도메인별 REST API 제공
- 권한 검사
- 동기 요청 처리
- 현재 answer preview 파이프라인 실행
- 후속 job enqueue 및 상태 관리

### 6.3 Workers
- 장시간 answer 분석 파이프라인 실행
- source extraction과 retry
- interpretation / verdict 저장
- 장기적인 알림 fan-out
- 현재 MVP preview 생성 경로에서는 worker를 거치지 않는다.

### 6.4 Data Layer
- 사용자 / 세션 / 프로필
- answer / evidence / result
- community
- notifications
- history
- popular read model input
- pending draft, answerId 승격, preview 상태, 오류, 알림 생성 여부
- 서버 notifications / notification_reads / preferences 기반 알림 목록과 읽음 상태

## 7. 환경 구성
지원 환경은 `dev`, `prod` 두 개다.

- `dev`와 `prod`는 각각 독립 배포 단위다.
- 환경 간 DB, Redis, 시크릿, 도메인, 배포 리소스를 공유하지 않는다.
- API shape와 DB 스키마 구조는 환경 간 동일하게 유지한다.
- `dev`는 mock 외부 연동을 기본 허용한다.
- `prod`는 실제 provider만 허용한다.
- 브랜드 표기는 `VARO`로 고정하고, `Verified Analysis, Reasoned Opinion`을 기본 포지셔닝 문구로 사용한다.
- 예정 production host `www.varocheck.com`은 config로만 관리하며, canonical host 상태가 `pending`인 동안은 URL 정책을 확정하지 않는다.

환경 타입:

- `AppEnv = "dev" | "prod"`
- `ExternalProviderMode = "mock" | "real"`

## 8. 보안과 운영

### 8.1 보안
- 비밀값은 env 또는 secret store로만 주입한다.
- `NEXT_PUBLIC_*`에는 비밀값을 넣지 않는다.
- 인증되지 않은 사용자는 보호된 화면과 API에 접근할 수 없다.
- 커뮤니티는 익명 사용을 허용하지 않는다.
- answer 결과는 원문 출처 링크와 함께 제공되어야 한다.

### 8.2 운영
- 모든 요청과 job에 trace id를 남긴다.
- `environment=dev|prod` 태그를 로그와 메트릭에 포함한다.
- 외부 API 실패율, answer 완료율, 알림 생성 성공률, 인기 집계 지연을 관측한다.
- answer preview 단계별 소요시간 로그를 관측한다.
- queue 적체와 외부 provider 장애는 서비스 품질에 직접 연결되는 운영 지표로 본다.

## 9. 문서 역할
- [Frontend Spec](./frontend-spec.md): 현재 프론트엔드 구조, 라우팅, 로컬 상태, API 소비 방식
- [Backend Spec](./backend-spec.md): 백엔드 구조, 프론트가 소비하는 엔드포인트, 비동기 처리
- [Data Model](./data-model.md): 서버 저장 모델과 현재 프론트 보조 저장 상태
- [ERD](./erd.md): 서비스 전체 엔티티 관계와 데이터 흐름
