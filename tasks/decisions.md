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
- 초기 실제 provider 조합은 Tavily search/extract + OpenAI structured outputs로 두었으나, 검색 provider 조합은 2026-04-21 Search Provider Routing 결정으로 대체한다.
- query refinement와 relevance filtering의 OpenAI 모델은 모두 `gpt-5-mini`로 고정한다.
- 인증 endpoint와 dev 테스트 endpoint는 같은 provider service 경로를 공유한다.
- `real` 모드에서는 API key 누락이나 provider 실패를 mock으로 숨기지 않고 명시적으로 실패시킨다.
- `languageCode`는 claim 엔터티에 저장하지 않고, query refinement artifact와 preview API 응답에서만 유지한다.

### Country-Aware Domain Routing
- 이 결정의 MVP 검색 provider 범위는 2026-04-21 Search Provider Routing 결정으로 대체되었다.
- 당시 설계에서는 국가별 trusted domain registry를 DB로 관리하고, Tavily `include_domains`로 familiar / verification pass를 분리하기로 했다.
- 한국 사용자에게는 한국 familiar domain을 우선 제공하되, 해외 이슈에서는 verification source 확보를 우선한다.
- retrieval bucket은 `familiar / verification / fallback` 3단계로 고정한다.
- 국가별 domain registry는 MVP에서 소수 핵심 도메인만 큐레이션한다.

### Korea-Related Only MVP Scope
- 이 결정은 2026-04-21의 Search Provider Routing 결정으로 대체되었다.
- 당시 MVP는 claim 자체에 한국 장소, 기관, 법인, 시장, 국민, 정책, 국내 영향이 포함된 경우만 검토하기로 했다.
- 당시에는 국내 맥락이 없는 순수 해외 이슈를 검토하지 않고 `out_of_scope` review job으로 기록하기로 했다.
- `out_of_scope`는 시스템 실패가 아니므로 `lastErrorCode`를 남기지 않고 verdict/result를 생성하지 않는 원칙은 유지한다.
- 당시 source search는 KR `source_domain_registry`만 사용하며, 국가별 해외 verification routing과 domainless fallback search는 MVP 범위에서 제거하기로 했다.
- `topicCountryCode`는 사용자 국가가 아니라 claim/context 기준의 주제 국가로 유지하며, domain routing에는 사용하지 않는다.
- retrieval bucket은 기존 저장/표시 호환성을 위해 `familiar / verification`을 유지하되, 신규 MVP 검색에서는 `fallback` bucket을 생성하지 않는다.
- KR social registry는 공식 인증 계정/원문 확인에 쓰이는 주요 플랫폼 도메인만 `familiar_social`로 등록하고, 익명 커뮤니티/개인 블로그/게시판 도메인은 registry에 넣지 않는다.

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

### Community Feed Integration
- 커뮤니티 1차 persisted 범위는 게시글 목록/상세/작성/수정/삭제, 댓글 작성, 게시글 공감 토글까지 포함한다.
- 커뮤니티 API는 `GET/POST /api/v1/community/posts`, `GET/PATCH/DELETE /api/v1/community/posts/:postId`, `POST /api/v1/community/posts/:postId/comments`, `POST/DELETE /api/v1/community/posts/:postId/likes`로 둔다.
- 커뮤니티 작성자 공개 정보는 `user_profiles.real_name / gender / age_range`를 기준으로 노출한다.
- 실명, 성별, 나이대 프로필이 없는 사용자는 커뮤니티 게시글 작성과 댓글 작성을 할 수 없다.

### Community Comment Threads
- 댓글 생성 API는 `parentCommentId` optional payload를 받아 루트 댓글과 대댓글을 같은 endpoint에서 처리한다.
- 댓글 삭제 API는 `DELETE /api/v1/community/posts/:postId/comments/:commentId`로 두고, 본인 댓글만 삭제할 수 있게 한다.
- 부모 댓글 삭제 시 Prisma cascade를 따라 하위 대댓글도 함께 삭제한다.
- 댓글 좋아요 API는 `POST/DELETE /api/v1/community/posts/:postId/comments/:commentId/likes`로 둔다.
- 게시글 상세 응답의 댓글 구조는 flat list가 아니라 `replies[]`를 가진 트리 구조로 반환한다.

## 2026-04-04

### Popular Topics v1
- 인기 주제는 `/popular` 탭 전용으로 노출하고 Home에는 노출하지 않는다.
- 인기 주제 집계 API는 `GET /api/v1/popular/topics`로 둔다.
- 인기 주제의 기본 집계 기준은 최근 24시간 내 `submitted + meaningful reopen` 합산 점수다.
- 인기 topic 그룹 키는 `queryRefinement.coreClaim` 우선, 없으면 `claims.normalized_text` fallback으로 사용한다.
- `meaningful reopen`은 `popular`, `history`, `notification`에서 기존 review preview로 재진입한 클릭만 포함한다.
- 최근 24시간 합산 점수가 10 이상인 topic만 `/popular`에 노출한다.
- `/popular` 정렬은 합산 점수 우선, 동률이면 submitted 수와 최신성 순으로 유지한다.
- 인기 항목 클릭 시 새 review를 만들지 않고 해당 topic의 대표 review preview로 재진입한다.
- 대표 review는 최근 24시간 구간에서 가장 최근에 생성되거나 재진입된 eligible review로 고정한다.
- `user_history`는 `submitted`, `reopened` entry를 저장하고, 인기 집계는 `review_jobs + user_history`를 읽는 실시간 read API로 구현한다.
- v1 인기 기능은 `popular_topics` 스냅샷 테이블과 worker를 도입하지 않는다.

## 2026-04-05

### Review Result Screen Contract
- `GET /api/v1/reviews/:reviewId`와 `POST /api/v1/reviews/query-processing-preview`는 preview artifact와 함께 result screen용 확장 detail 계약을 반환한다.
- result screen용 `verdict`, `confidenceScore`, `consensusLevel`, `analysisSummary`, `uncertainty`는 DB 저장 없이 조회 시점 규칙 기반 파생 값으로 생성한다.
- 위 임시 result는 `rule_based_preview` 모드로 명시하고, 이후 interpretation 단계의 LLM 결과로 교체 가능하게 둔다.
- review detail 조회는 반드시 `userId + reviewId` owner scope를 함께 검증한다.

### Deployment Architecture
- production 배포는 단일 레포를 유지하되 `frontend`와 `backend`를 별도 Docker image로 분리한다.
- production 초기 인프라는 `EC2 1대 + host Nginx + Docker Compose + GHCR + GitHub Actions self-hosted runner` 조합으로 시작했지만, 이 결정은 2026-04-11의 containerized nginx/certbot 결정으로 대체한다.
- production EC2 인스턴스 OS는 `Amazon Linux 2023`, 아키텍처는 `ARM64 / aarch64`로 고정한다.
- production 도메인은 `www.varocheck.com`과 `api.varocheck.com`을 분리한다.
- Nginx는 `www`를 frontend 컨테이너, `api`를 backend 컨테이너로 reverse proxy 한다.
- backend production health endpoint는 `GET /api/v1/health`로 제공한다.
- production DB는 비용 절감을 위해 같은 EC2에서 Docker Compose 기반 PostgreSQL로 운영한다.
- backend `DATABASE_URL`은 같은 compose 네트워크의 `postgres` 서비스를 가리키게 한다.
- 로컬 PC에서 Postgres 접속이 필요할 때는 `5432` 공개 대신 SSH tunnel 방식을 사용한다.
- 자동배포는 GitHub-hosted runner의 SSH 접속 대신 EC2 내부 self-hosted runner가 로컬 배포 스크립트를 실행하는 방식으로 둔다.

## 2026-04-07

### Cross-Subdomain Session Cookie
- production에서 `www.varocheck.com`과 `api.varocheck.com`을 함께 사용할 때 세션 쿠키는 공유 domain 기반으로 발급한다.
- 세션 쿠키 domain은 backend env `SESSION_COOKIE_DOMAIN`으로 제어하고, 값이 없더라도 표준 `www`/`api` 호스트 조합이면 `varocheck.com`을 자동 추론한다.
- OAuth state cookie는 callback 검증 범위를 줄이기 위해 기존대로 host-only cookie를 유지한다.

### Production CD Cost Reduction
- production CD의 Docker image build는 GitHub-hosted runner가 아니라 EC2 self-hosted runner에서 수행한다.
- `main` push 시 CD는 변경 파일을 기준으로 `frontend` / `backend` 중 필요한 서비스만 build, push, deploy 한다.
- GHCR production 태그 정책은 immutable 7자리 `short SHA` + 최신 배포 별칭 `prod` 조합으로 유지한다.
- production deploy는 항상 `prod`가 아니라 immutable `short SHA` 태그를 사용한다.
- GHCR cleanup은 서비스별 최신 `short SHA` 10개와 `prod`가 붙은 버전만 남기고 나머지를 정리한다.

## 2026-04-11

### Production Reverse Proxy Runtime
- production reverse proxy와 TLS termination은 host Nginx가 아니라 Docker Compose 기반 `nginx` 컨테이너로 운영한다.
- TLS 인증서 발급과 갱신은 Docker Compose 기반 `certbot` 컨테이너를 사용하고, challenge 방식은 `webroot`로 고정한다.
- production 초기 인프라는 `EC2 1대 + nginx container + certbot container + Docker Compose + GHCR + GitHub Actions self-hosted runner` 조합으로 갱신한다.
- 외부 공개 포트 `80`, `443`은 `nginx` 컨테이너만 bind 하고 `frontend`, `backend`, `postgres`는 compose 내부 네트워크로만 연결한다.
- 컨테이너용 Nginx 활성 설정은 `/srv/varo/nginx/conf.d/*.conf`, 공통 include는 `/srv/varo/nginx/includes/*.conf`, 템플릿은 `/srv/varo/nginx/templates/*`에 둔다.
- certbot webroot와 인증서 저장소는 각각 `/srv/varo/certbot/www`, `/srv/varo/certbot/conf`를 사용한다.
- 배포 스크립트는 `http-only nginx 기동 -> certbot 발급/갱신 -> TLS nginx reload -> app deploy` 순서를 따른다.

## 2026-04-15

### Review Task History Deduplication
- review task history는 `claim + 시간` 휴리스틱이 아니라 `clientRequestId`를 우선 병합 키로 사용한다.
- `GET /api/v1/reviews` summary와 review detail 응답은 local pending draft와 server review job을 연결할 수 있도록 `clientRequestId`를 노출한다.
- frontend의 local `draftId`는 review 생성 요청의 `clientRequestId`로 유지하고, 같은 값이 서버 응답에 있으면 하나의 history item으로 병합한다.
- `/loading`의 성공 여부는 HTTP 요청 성공이 아니라 review payload의 `status/currentStage`를 기준으로 판정한다.
- 서버가 `failed` 상태의 review detail을 반환하면 frontend는 성공 CTA와 completion notification을 만들지 않고 실패 상태를 유지한다.

## 2026-04-19

### Settings Beta Follow-Up
- `/settings/privacy`, `/settings/notifications`, `/settings/support`를 MVP 정보형 화면으로 추가한다.
- 개인정보 보호 페이지는 정식 법무 문서가 아니라 현재 구현 기준의 MVP 처리방침 요약으로 제공한다.
- 알림 설정은 frontend localStorage 기반으로 관리하고 기본값은 `review 완료`, `커뮤니티 댓글`, `커뮤니티 좋아요` 모두 `on`으로 둔다.
- 이번 단계에서 실제로 생성 제어되는 알림은 `review 완료`만 포함한다.
- `커뮤니티 댓글/좋아요 알림`은 설정 UI와 저장 구조만 선반영하고 실제 알림 생성/전달은 후속 작업으로 분리한다.
- 고객 센터 페이지는 FAQ와 임시 문의 안내만 제공하고 실제 문의 접수 채널은 연결하지 않는다.

### Server-Backed Notifications
- 알림의 source of truth는 browser localStorage가 아니라 server DB/API로 전환한다.
- 알림 설정은 `user_notification_preferences` 테이블로 저장하고 기본값은 `review 완료`, `커뮤니티 댓글`, `커뮤니티 좋아요` 모두 `on`으로 둔다.
- 알림 목록 읽음 상태는 `notifications` + `notification_reads` 모델로 관리한다.
- review 완료 알림은 review preview의 terminal non-failed 완료 시 서버에서 생성한다.
- 댓글 알림은 게시글 작성자와 부모 댓글 작성자에게 보내고 자기 자신 알림은 생성하지 않는다.
- 좋아요 알림은 게시글 좋아요와 댓글 좋아요를 모두 포함하며 최초 like 생성 시에만 보낸다.
- 커뮤니티 알림 target은 MVP에서 post detail 페이지로 통일하고 comment anchor deep link는 후속 범위로 남긴다.

## 2026-04-21

### Search Provider Routing
- 2026-04-01의 Korea-Related Only MVP Scope 결정은 검색 범위 기준에서 대체한다.
- 이 결정의 해외/글로벌 route 범위는 2026-04-28 최신 결정으로 대체되었다.
- 신규 review 생성 기준 query refinement는 `search_route`를 `korean_news / unsupported` 중 하나로 판정한다.
- `korean_news` route는 Naver News Search API를 기본 검색 provider로 사용한다.
- Tavily Search는 한국 뉴스 보조 검색 provider로 사용하고, Tavily Extract는 본문 추출 provider로 사용한다.
- `search_route`는 검색 provider 분기의 authoritative field로 사용하고, `isKoreaRelated`는 UX/설명용 메타데이터로만 유지한다.
- `unsupported` route는 뉴스성 또는 사실성 검토 대상이 아니거나 provider로 근거 수집이 불가능한 claim에만 사용하며, `out_of_scope` review job으로 기록한다.
- 네이버 뉴스 검색 결과는 `title`, `description`, `originallink`, `link`, `pubDate`를 source candidate로 정규화하고, evidence snippet 생성을 위한 본문 확보는 기존 source fetch/extraction 계층에서 처리한다.
- `real` 모드에서는 Naver, Tavily, OpenAI API key 누락이나 provider 실패를 mock으로 숨기지 않고 명시적으로 실패시킨다.

## 2026-04-26

### Claim Understanding 기반 Search Planning
- review query refinement는 단순 키워드 추출이 아니라 claim understanding + search planning 단계로 확장한다.
- `search_route`는 provider routing의 authoritative field로 유지하고, `search_plan`은 검증 목적별 검색 질의 생성을 담당한다.
- 기본 search plan query purpose는 `claim_specific`, `current_state`, `primary_source`, `contradiction_or_update` 4개로 고정한다.
- provider 검색은 기존 `generated_queries/search_queries`보다 `search_plan.queries`를 우선 사용한다.
- preview API 응답 shape는 이번 단계에서 변경하지 않고, `search_plan`은 query refinement artifact와 내부 traceability에만 저장한다.
- Prisma migration은 도입하지 않고 기존 JSON artifact와 `origin_query_ids` 기반 추적을 유지한다.

## 2026-04-27

### Review Summary Copy
- `rule_based_preview`의 `analysisSummary`는 신규 LLM 호출 없이 기존 source, evidence snippet, source stance, search plan purpose를 기반으로 생성한다.
- summary는 지지/충돌/맥락 카운트 나열보다 사용자 질문에 대한 직접 답변, 최신 업데이트 신호, 공식 출처 여부, 남은 불확실성을 우선 설명한다.
- API 응답 shape, DB schema, Prisma migration은 변경하지 않는다.

### Evidence Signal Consensus
- 요약 문장은 DB에 저장하지 않는다.
- OpenAI는 review 생성 시점에 source/evidence별 signal만 structured output으로 분류한다.
- `EvidenceSnippet.stance`에는 UI/호환용 `support`, `conflict`, `context`, `unknown` 값을 저장하고, 상세 signal은 `review_jobs.handoff_payload.evidenceSignals[]`에 저장한다.
- `/reviews/:reviewId` 조회 시에는 OpenAI를 호출하지 않고 저장된 signal과 source trace로 `sourceStances`, `consensusLevel`, `analysisSummary`를 계산한다.
- scheduled event에서 최신 `latest_update/current_status` signal이 `weakens` 또는 `overrides`이면 과거 support가 많아도 합의성을 낮게 표시한다.

## 2026-04-28

### Tavily KR Trusted Domain Registry
- Tavily Search의 `include_domains`는 DB `source_domain_registry` 조회가 아니라 백엔드 코드에 고정된 한국 trusted news domain registry를 사용한다.
- Tavily Search 범위는 한겨레, 경향신문, 오마이뉴스, 프레시안, 연합뉴스, 한국일보, 국민일보, SBS, JTBC, 조선일보, 중앙일보, 동아일보, 문화일보, TV조선, 매일경제, 한국경제, 서울경제, 머니투데이, 이데일리 도메인으로 제한한다.
- registry에는 `progressive`, `centrist`, `conservative`, `business` 성향 메타데이터를 함께 저장한다.
- 정치 성향 메타데이터는 검색 결과 균형과 출처 설명을 위한 내부 메타데이터이며, verdict 또는 출처 신뢰도 점수로 사용하지 않는다.
- 이번 변경은 API 응답 shape, DB schema, Prisma migration을 변경하지 않는다.

### MVP Political/Economic Claim Scope
- 2026-04-21 Search Provider Routing 결정은 유지하되, MVP 검토 도메인은 이번 결정으로 정치·경제로 좁힌다.
- MVP 검토 범위는 국가와 무관한 뉴스성 claim 전체가 아니라 정치·경제 도메인의 사실성 claim으로 좁힌다.
- 정치는 일반 정치 이슈까지 포함하되, 정치인 발언, 정당/정부 입장, 선거, 정책, 공약, 법안, 예산처럼 출처로 검증 가능한 claim에 한정한다.
- 경제는 금리, 물가, 세금, 부동산, 기업 공식 발표, 공시, 경제 지표처럼 출처로 검증 가능한 claim에 한정한다.
- 의료, 연예, 스포츠, 개인 상담, 창작 요청, 순수 의견, 미래 예측, 투자 매수/매도 추천은 MVP 지원 범위 밖으로 처리한다.
- 사용자는 입력 전에 도메인을 직접 선택하지 않고, query refinement가 `topic_domain`을 `politics / economy / unsupported` 중 하나로 자동 판정한다.
- `topic_domain`은 제품 지원 도메인 판정, `search_route`는 검색 가능 여부 판정으로 별도 유지한다.
- DB schema, Prisma migration, 공개 API 응답 shape는 이번 결정으로 변경하지 않는다.

### Review Preview Latency Reduction
- Naver News Search는 query별 상위 10개를 병렬로 요청하되, timeout은 코드에서 최대 8초로 제한한다.
- 일부 Naver query가 실패해도 성공한 query 결과가 있으면 전체 review를 실패시키지 않고 partial source pool로 계속 진행한다.
- Tavily Search는 Naver 후보가 15건 미만일 때만 fallback으로 호출하며, timeout은 최대 8초로 제한한다.
- relevance filtering과 evidence signal classification은 별도 OpenAI 호출로 나누지 않고 단일 structured output 호출로 처리한다.

### Korea News Only With Tavily Search Fallback
- 2026-04-21 Search Provider Routing의 해외/글로벌 뉴스 route는 신규 생성 기준에서 사용하지 않는다.
- MVP 검토 범위는 한국 관련 정치·경제 claim으로 고정한다.
- 해외/글로벌 뉴스 claim은 정치·경제 주제라도 `unsupported/out_of_scope`로 처리하고, VARO가 현재 한국뉴스만 분석한다고 안내한다.
- 신규 review 생성 기준 `search_route`는 `korean_news / unsupported`만 사용한다.
- OpenAI는 query refinement 전에 scope gate를 먼저 수행하고, 한국 관련 정치·경제 뉴스성 claim이 아니면 search plan/query 생성을 생략한 뒤 `out_of_scope`로 저장한다.
- Tavily Search는 제거하지 않고 `korean_news`에서 Naver 후보가 부족할 때만 실행되는 한국 뉴스 보조 source search provider로 사용한다.
- Tavily Search는 코드에 고정된 KR trusted news domain registry 기반 include domain으로 제한하고, 한국 출처로 확인되는 후보만 유지한다.
- source별 수집 API는 `sources.source_provider`에 저장하고, DB 기반 `source_domain_registry` 테이블과 `sources.domain_registry_id`는 코드 고정 registry 전환에 따라 제거한다.
- `TAVILY_API_KEY`, `TAVILY_SEARCH_TIMEOUT_MS`, `TAVILY_EXTRACT_TIMEOUT_MS` 설정을 유지한다.
