# Decisions

## 2026-05-04

### Context Answer With News Mode
- `checkType`은 검토 대상 성격 힌트로 유지하고 복합/설명형 흐름을 위해 확장하지 않는다.
- 신규 answer 처리 구분값으로 `answerMode=fact_check|direct_answer|context_answer_with_news`를 도입한다.
- 한국 정치·경제 설명형 질문은 `context_answer_with_news`로 분류하고, OpenAI 직접 답변과 Naver 관련 뉴스 목록을 함께 제공한다.
- `answerMode`를 처리와 UI 분기의 기준값으로 사용한다.
- `context_answer_with_news`는 서버에서 `searchRoute=supported`로 보정하며, Naver 검색용 `searchPlan.queries`를 생성한다.
- `context_answer_with_news`에서는 fact-check verdict, confidence, consensus를 생성하거나 노출하지 않는다.
- 기존 저장 데이터 호환을 위해 `answerMode`가 없는 artifact는 `searchRoute` 기준으로 fallback한다.
- 이번 변경은 DB schema와 Prisma migration을 변경하지 않는다.

### Guest Core Access
- 홈, answer 생성/조회, 히스토리, 인기 주제, 헤드라인은 비로그인 사용자도 이용할 수 있게 한다.
- 커뮤니티, 알림, 설정, 내 정보, 온보딩 프로필은 로그인 전용으로 유지한다.
- 비로그인 사용자는 HttpOnly 게스트 쿠키로 브라우저별 익명 기록을 유지한다.
- 게스트 answer 생성 제한은 MVP 기준 일일 20회로 둔다.
- 게스트 결과는 로그인 후 계정으로 자동 병합하지 않는다.
- 프로필 미완성 로그인 사용자도 홈, answer, 인기 주제, 헤드라인은 이용할 수 있다.

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

### Answer Query Processing
- answer query processing 1차 구현 범위는 `check intake ~ evidence preparation`까지로 제한한다.
- answer query backend의 1차 공개 API는 `POST /api/v1/answers/query-processing-preview`로 둔다.
- query refinement와 relevance filtering의 출력 모델은 `primary / reference / discard` 3단계로 고정한다.
- source traceability는 source별 `origin_query_ids[]`를 유지하는 방식으로 구현한다.
- answer provider는 환경별 mock/real mode 분기 없이 실제 provider 설정을 기준으로 동작한다.
- 1차 extraction 대상은 `primary` 우선, 부족 시 `reference` 제한 승격으로 처리한다.
- 초기 실제 provider 조합은 Tavily search/extract + OpenAI structured outputs로 두었으나, 검색 provider 조합은 2026-04-21 Search Provider Routing 결정으로 대체한다.
- query refinement와 relevance filtering의 OpenAI 모델은 모두 `gpt-5-mini`로 고정한다.
- 인증 endpoint와 dev 테스트 endpoint는 같은 provider service 경로를 공유한다.
- `real` 모드에서는 API key 누락이나 provider 실패를 mock으로 숨기지 않고 명시적으로 실패시킨다.
- `languageCode`는 2026-04-29 결정에 따라 query refinement artifact와 preview API 응답에서도 제거한다.

### Country-Aware Domain Routing
- 이 결정의 MVP 검색 provider 범위는 2026-04-21 Search Provider Routing 결정으로 대체되었다.
- 당시 설계에서는 국가별 trusted domain registry를 DB로 관리하고, Tavily `include_domains`로 familiar / verification pass를 분리하기로 했다.
- 한국 사용자에게는 한국 familiar domain을 우선 제공하되, 해외 이슈에서는 verification source 확보를 우선한다.
- retrieval bucket은 `familiar / verification / fallback` 3단계로 고정한다.
- 국가별 domain registry는 MVP에서 소수 핵심 도메인만 큐레이션한다.

### Korea-Related Only MVP Scope
- 이 결정은 2026-04-21의 Search Provider Routing 결정으로 대체되었다.
- 당시 MVP는 check 자체에 한국 장소, 기관, 법인, 시장, 국민, 정책, 국내 영향이 포함된 경우만 검토하기로 했다.
- 당시에는 국내 맥락이 없는 순수 해외 이슈를 검토하지 않고 `out_of_scope` answer job으로 기록하기로 했다.
- `out_of_scope`는 시스템 실패가 아니므로 `lastErrorCode`를 남기지 않고 verdict/result를 생성하지 않는 원칙은 유지한다.
- 당시 source search는 KR `source_domain_registry`만 사용하며, 국가별 해외 verification routing과 domainless fallback search는 MVP 범위에서 제거하기로 했다.
- retrieval bucket은 기존 저장/표시 호환성을 위해 `familiar / verification`을 유지하되, 신규 MVP 검색에서는 `fallback` bucket을 생성하지 않는다.
- KR social registry는 공식 인증 계정/원문 확인에 쓰이는 주요 플랫폼 도메인만 `familiar_social`로 등록하고, 익명 커뮤니티/개인 블로그/게시판 도메인은 registry에 넣지 않는다.

## 2026-04-02

### Answers Preview Integration
- `/answers/[answerId]`는 최종 verdict 화면이 아니라 `query-processing-preview` 결과를 보여주는 evidence-first preview 화면으로 연결한다.
- interpretation과 verdict가 아직 생성되지 않은 단계는 UI에서 명시적으로 안내한다.
- preview 연동용 읽기 API는 `GET /api/v1/answers`, `GET /api/v1/answers/:answerId`로 둔다.
- `POST /api/v1/answers/query-processing-preview`와 `GET /api/v1/answers/:answerId`는 같은 preview detail 계약을 공유한다.
- answer preview detail 계약에는 `rawCheck`, `createdAt`, source `originalUrl`, source `publishedAt`을 포함한다.
- history drawer는 verdict 대신 `status/currentStage` 기반 상태 라벨을 노출한다.

### Frontend Answer Task Flow
- answer preview 생성 요청의 소유권은 `loading` 페이지가 아니라 프론트 전역 answer task store가 가진다.
- active answer task가 진행 중이면 `Home` 진입 시 입력 화면 대신 기존 `/loading`으로 복귀시켜 중복 요청을 막는다.
- history는 `check + 시간` 휴리스틱 대신 `draftId -> answerId` 승격 방식으로 중복 없이 병합한다.
- answer completion 알림은 `loading` 화면이 아니라 answer task 성공 전이에서 1회 생성한다.

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
- 인기 topic 그룹 키는 `queryRefinement.coreCheck` 우선, 없으면 `checks.normalized_text` fallback으로 사용한다.
- `meaningful reopen`은 `popular`, `history`, `notification`에서 기존 answer preview로 재진입한 클릭만 포함한다.
- 최근 24시간 합산 점수가 10 이상인 topic만 `/popular`에 노출한다.
- `/popular` 정렬은 합산 점수 우선, 동률이면 submitted 수와 최신성 순으로 유지한다.
- 인기 항목 클릭 시 새 answer를 만들지 않고 해당 topic의 대표 answer preview로 재진입한다.
- 대표 answer는 최근 24시간 구간에서 가장 최근에 생성되거나 재진입된 eligible answer로 고정한다.
- `user_history`는 `submitted`, `reopened` entry를 저장하고, 인기 집계는 `answer_jobs + user_history`를 읽는 실시간 read API로 구현한다.
- v1 인기 기능은 `popular_topics` 스냅샷 테이블과 worker를 도입하지 않는다.

## 2026-04-05

### Answer Result Screen Contract
- `GET /api/v1/answers/:answerId`와 `POST /api/v1/answers/query-processing-preview`는 preview artifact와 함께 result screen용 확장 detail 계약을 반환한다.
- result screen용 `verdict`, `confidenceScore`, `consensusLevel`, `analysisSummary`, `uncertainty`는 DB 저장 없이 조회 시점 규칙 기반 파생 값으로 생성한다.
- 위 임시 result는 `rule_based_preview` 모드로 명시하고, 이후 interpretation 단계의 LLM 결과로 교체 가능하게 둔다.
- answer detail 조회는 반드시 `userId + answerId` owner scope를 함께 검증한다.

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

### Answer Task History Deduplication
- answer task history는 `check + 시간` 휴리스틱이 아니라 `clientRequestId`를 우선 병합 키로 사용한다.
- `GET /api/v1/answers` summary와 answer detail 응답은 local pending draft와 server answer job을 연결할 수 있도록 `clientRequestId`를 노출한다.
- frontend의 local `draftId`는 answer 생성 요청의 `clientRequestId`로 유지하고, 같은 값이 서버 응답에 있으면 하나의 history item으로 병합한다.
- `/loading`의 성공 여부는 HTTP 요청 성공이 아니라 answer payload의 `status/currentStage`를 기준으로 판정한다.
- 서버가 `failed` 상태의 answer detail을 반환하면 frontend는 성공 CTA와 completion notification을 만들지 않고 실패 상태를 유지한다.

## 2026-04-19

### Settings Beta Follow-Up
- `/settings/privacy`, `/settings/notifications`, `/settings/support`를 MVP 정보형 화면으로 추가한다.
- 개인정보 보호 페이지는 정식 법무 문서가 아니라 현재 구현 기준의 MVP 처리방침 요약으로 제공한다.
- 알림 설정은 frontend localStorage 기반으로 관리하고 기본값은 `answer 완료`, `커뮤니티 댓글`, `커뮤니티 좋아요` 모두 `on`으로 둔다.
- 이번 단계에서 실제로 생성 제어되는 알림은 `answer 완료`만 포함한다.
- `커뮤니티 댓글/좋아요 알림`은 설정 UI와 저장 구조만 선반영하고 실제 알림 생성/전달은 후속 작업으로 분리한다.
- 고객 센터 페이지는 FAQ와 임시 문의 안내만 제공하고 실제 문의 접수 채널은 연결하지 않는다.

### Server-Backed Notifications
- 알림의 source of truth는 browser localStorage가 아니라 server DB/API로 전환한다.
- 알림 설정은 `user_notification_preferences` 테이블로 저장하고 기본값은 `answer 완료`, `커뮤니티 댓글`, `커뮤니티 좋아요` 모두 `on`으로 둔다.
- 알림 목록 읽음 상태는 `notifications` + `notification_reads` 모델로 관리한다.
- answer 완료 알림은 answer preview의 terminal non-failed 완료 시 서버에서 생성한다.
- 댓글 알림은 게시글 작성자와 부모 댓글 작성자에게 보내고 자기 자신 알림은 생성하지 않는다.
- 좋아요 알림은 게시글 좋아요와 댓글 좋아요를 모두 포함하며 최초 like 생성 시에만 보낸다.
- 커뮤니티 알림 target은 MVP에서 post detail 페이지로 통일하고 comment anchor deep link는 후속 범위로 남긴다.

## 2026-04-21

### Search Provider Routing
- 2026-04-01의 Korea-Related Only MVP Scope 결정은 검색 범위 기준에서 대체한다.
- 이 결정의 해외/글로벌 route 범위는 2026-04-28 최신 결정으로 대체되었다.
- 신규 answer 생성 기준 query refinement는 `search_route`를 `supported / unsupported` 중 하나로 판정한다.
- `supported` route는 Naver News Search API를 기본 검색 provider로 사용한다.
- Tavily Search는 한국 뉴스 보조 검색 provider로 사용하고, Tavily Extract는 본문 추출 provider로 사용한다.
- `unsupported` route는 뉴스성 또는 사실성 검토 대상이 아니거나 provider로 근거 수집이 불가능한 check에만 사용하며, `out_of_scope` answer job으로 기록한다.
- 네이버 뉴스 검색 결과는 `title`, `description`, `originallink`, `link`, `pubDate`를 source candidate로 정규화하고, evidence snippet 생성을 위한 본문 확보는 기존 source fetch/extraction 계층에서 처리한다.
- `real` 모드에서는 Naver, Tavily, OpenAI API key 누락이나 provider 실패를 mock으로 숨기지 않고 명시적으로 실패시킨다.

## 2026-04-26

### Check Understanding 기반 Search Planning
- answer query refinement는 단순 키워드 추출이 아니라 check understanding + search planning 단계로 확장한다.
- `search_route`는 provider routing의 authoritative field로 유지하고, `search_plan`은 검증 목적별 검색 질의 생성을 담당한다.
- 기본 search plan query purpose는 `check_specific`, `current_state`, `primary_source`, `contradiction_or_update` 4개로 고정한다.
- provider 검색은 기존 `generated_queries/search_queries`보다 `search_plan.queries`를 우선 사용한다.
- preview API 응답 shape는 이번 단계에서 변경하지 않고, `search_plan`은 query refinement artifact와 내부 traceability에만 저장한다.
- Prisma migration은 도입하지 않고 기존 JSON artifact와 `origin_query_ids` 기반 추적을 유지한다.

## 2026-04-27

### Answer Summary Copy
- 이 결정은 2026-04-30의 OpenAI Answer Summary 결정으로 대체되었다.
- 당시 `rule_based_preview`의 `analysisSummary`는 신규 LLM 호출 없이 기존 source, evidence snippet, source stance, search plan purpose를 기반으로 생성하기로 했다.
- summary는 지지/충돌/맥락 카운트 나열보다 사용자 질문에 대한 직접 답변, 최신 업데이트 신호, 공식 출처 여부, 남은 불확실성을 우선 설명한다.
- API 응답 shape, DB schema, Prisma migration은 변경하지 않는다.

### Evidence Signal Consensus
- 이 결정의 요약 문장 저장 방식은 2026-04-30의 OpenAI Answer Summary 결정으로 대체되었다.
- OpenAI는 answer 생성 시점에 source/evidence별 signal만 structured output으로 분류한다.
- `EvidenceSnippet.stance`에는 UI/호환용 `support`, `conflict`, `context`, `unknown` 값을 저장하고, 상세 signal은 `answer_jobs.handoff_payload.evidenceSignals[]`에 저장한다.
- `/answers/:answerId` 조회 시에는 OpenAI를 호출하지 않고 저장된 signal과 source trace로 `sourceStances`, `consensusLevel`을 계산한다.
- scheduled event에서 최신 `latest_update/current_status` signal이 `weakens` 또는 `overrides`이면 과거 support가 많아도 합의성을 낮게 표시한다.

## 2026-04-30

### OpenAI Answer Summary
- answer result 화면의 `analysisSummary`, `uncertaintySummary`, `uncertaintyItems`는 규칙 기반 문장 조립 대신 OpenAI structured output으로 생성한다.
- summary 생성은 relevance / evidence signal 분류와 같은 OpenAI 호출에서 함께 처리한다.
- 생성된 summary는 `answer_jobs.handoff_payload.answerSummary`에 저장하고, `/answers/:answerId` 조회 시 OpenAI를 다시 호출하지 않는다.
- `sourceStances`, `verdict`, `confidenceScore`, `consensusLevel`, count, source breakdown은 기존 API 계약 유지를 위해 서버에서 파생한다.
- DB schema와 API 응답 shape는 변경하지 않는다.

### Today Headlines Category Analysis
- `/headlines` 기본 경험은 매체별 RSS 표 없이 사건별 헤드라인 표현 비교만 노출하는 것으로 둔다.
- `headline_analyses`는 `date_key + category` 단위로 저장하고, unique 기준도 `date_key + category`로 둔다.
- `headline_articles`는 정치/경제를 별도 테이블로 나누지 않고 `category` 컬럼으로 구분한다.
- 새벽 1시 cron은 정치 RSS와 경제 RSS를 각각 수집하고, 각 카테고리별 분석을 별도로 생성한다.
- 같은 날짜/카테고리에 이미 저장된 `publisher_key`가 있으면 수동 수집에서 해당 매체 RSS는 다시 추가하지 않는다.
- 헤드라인 분석은 RSS 제목만으로 1차 군집화하고, OpenAI는 cluster 후보의 사건명, 짧은 요약, 매체별 표현 차이 정리에만 사용하며 사실 판정이나 매체 신뢰도 점수로 확장하지 않는다.
- 분석 사건 묶음은 서로 다른 보도 매체 수가 많은 순으로 표시하고, 동률이면 포함 기사 수를 다음 정렬 기준으로 사용한다.
- OpenAI 분석 응답에서 누락된 기사는 단일 기사 사건으로 보존해 분석 결과에서 사라지지 않게 한다.

## 2026-05-01

### Answer Provider Routing Cost Optimization
- 신규 answer 생성의 query refinement는 항상 OpenAI structured output으로 수행한다.
- `answerMode=fact_check`이고 `searchRoute=supported`이면 Naver News Search로 출처를 수집하고 OpenAI로 relevance, evidence signal, answer summary를 생성한다.
- `answerMode=direct_answer`이면 out_of_scope로 기록하지 않고 직접 답변을 사용하되, 이 결과는 출처 기반 fact-check verdict가 아니라 직접 답변으로 표시한다.
- `answerMode=fact_check`이고 `searchRoute=unsupported`이면 기존처럼 지원 범위 밖 answer로 기록하고 verdict를 생성하지 않는다.
- 기존 저장 데이터 호환을 위해 `llm_direct` route parsing과 `perplexity-sonar` source provider는 유지한다.

## 2026-04-28

### Tavily KR Trusted Domain Registry
- Tavily Search의 `include_domains`는 DB `source_domain_registry` 조회가 아니라 백엔드 코드에 고정된 한국 trusted news domain registry를 사용한다.
- Tavily Search 범위는 한겨레, 경향신문, 오마이뉴스, 프레시안, 연합뉴스, 한국일보, 국민일보, SBS, JTBC, 조선일보, 중앙일보, 동아일보, 문화일보, TV조선, 매일경제, 한국경제, 서울경제, 머니투데이, 이데일리 도메인으로 제한한다.
- registry에는 `progressive`, `centrist`, `conservative`, `business` 성향 메타데이터를 함께 저장한다.
- 정치 성향 메타데이터는 검색 결과 균형과 출처 설명을 위한 내부 메타데이터이며, verdict 또는 출처 신뢰도 점수로 사용하지 않는다.
- 이번 변경은 API 응답 shape, DB schema, Prisma migration을 변경하지 않는다.

### MVP Political/Economic Check Scope
- 2026-04-21 Search Provider Routing 결정은 유지하되, MVP 검토 도메인은 이번 결정으로 정치·경제로 좁힌다.
- MVP 검토 범위는 국가와 무관한 뉴스성 check 전체가 아니라 정치·경제 도메인의 사실성 check으로 좁힌다.
- 정치는 일반 정치 이슈까지 포함하되, 정치인 발언, 정당/정부 입장, 선거, 정책, 공약, 법안, 예산처럼 출처로 검증 가능한 check에 한정한다.
- 경제는 금리, 물가, 세금, 부동산, 기업 공식 발표, 공시, 경제 지표처럼 출처로 검증 가능한 check에 한정한다.
- 의료, 연예, 스포츠, 개인 상담, 창작 요청, 순수 의견, 미래 예측, 투자 매수/매도 추천은 MVP 지원 범위 밖으로 처리한다.
- 사용자는 입력 전에 도메인을 직접 선택하지 않고, query refinement가 `search_route`를 판정한다.
- `search_route`는 검색 가능 여부 및 도메인 판정을 담당한다.
- DB schema, Prisma migration, 공개 API 응답 shape는 이번 결정으로 변경하지 않는다.

### Answer Preview Latency Reduction
- Naver News Search는 query별 상위 8개를 병렬로 요청하되, timeout은 코드에서 최대 8초로 제한한다.
- 일부 Naver query가 실패해도 성공한 query 결과가 있으면 전체 answer를 실패시키지 않고 partial source pool로 계속 진행한다.
- Tavily Search는 Naver 후보가 15건 미만일 때만 fallback으로 호출하며, timeout은 최대 8초로 제한한다.
- relevance filtering과 evidence signal classification은 별도 OpenAI 호출로 나누지 않고 단일 structured output 호출로 처리한다.

### News Only With Tavily Search Fallback
- 2026-04-21 Search Provider Routing의 해외/글로벌 뉴스 route는 신규 생성 기준에서 사용하지 않는다.
- MVP 검토 범위는 정치·경제 check으로 고정한다.
- 해외/글로벌 뉴스 check은 정치·경제 주제라도 `unsupported/out_of_scope`로 처리한다.
- 신규 answer 생성 기준 `search_route`는 `supported / unsupported`만 사용한다.
- OpenAI는 query refinement 전에 scope gate를 먼저 수행하고, 정치·경제 뉴스성 check이 아니면 search plan/query 생성을 생략한 뒤 `out_of_scope`로 저장한다.
- Tavily Search는 제거하지 않고 `supported`에서 Naver 후보가 부족할 때만 실행되는 뉴스 보조 source search provider로 사용한다.
- Tavily Search는 코드에 고정된 trusted news domain registry 기반 include domain으로 제한하고, 신뢰할 수 있는 출처로 확인되는 후보만 유지한다.
- source별 수집 API는 `sources.source_provider`에 저장하고, DB 기반 `source_domain_registry` 테이블과 `sources.domain_registry_id`는 코드 고정 registry 전환에 따라 제거한다.
- `TAVILY_API_KEY`, `TAVILY_SEARCH_TIMEOUT_MS`, `TAVILY_EXTRACT_TIMEOUT_MS` 설정을 유지한다.

## 2026-04-29

### Async Answer Preview Polling
- answer preview는 검색 완료 후 source를 먼저 노출하고, relevance/evidence signal 분류는 background에서 이어서 처리한다.
- MVP 실시간 갱신 방식은 SSE가 아니라 기존 `GET /api/v1/answers/:answerId` 기반 polling으로 구현한다.
- 새 생성 API는 `POST /api/v1/answers/query-processing-preview/async`로 두고, 기존 동기 API는 호환용으로 유지한다.
- 검색 직후 응답은 기존 detail 응답 shape를 유지하되 `status=searching`, `currentStage=relevance_and_signal_classification`, `result=null`, `sources[]`로 표현한다.
- 별도 queue/worker는 도입하지 않고 단일 backend 인스턴스 전제의 in-process background promise로 처리한다.
- DB schema와 Prisma migration은 변경하지 않는다.

### Remove Check Language Metadata
- MVP는 한국뉴스 전용이므로 `checkLanguageCode`와 preview 응답의 `languageCode`를 제거한다.
- OpenAI relevance/evidence signal 분류 입력에도 check language field를 전달하지 않는다.
- 한국 trusted domain registry는 언어 메타데이터 없이 국가와 source 역할만 유지한다.

### Query Refinement Contract Simplification
- `QueryRefinementResult`에서 `verificationGoal`, `searchCheck`, `searchQueries`를 제거한다.
- `SearchPlan`은 중복 메타데이터 없이 `queries[]`만 유지한다.
- `checkType`은 query refinement의 top-level field로만 유지하고, result assembly에는 별도 입력으로 전달한다.

### Source Political Lean Badge
- 결과 페이지 source card에는 `style.txt` 기준 뉴스사 성향 배지를 표시한다.
- 화면 표시 성향은 `진보 / 보수 / 중도 / 기타` 4개 라벨로 제한하고, 진보는 파란색, 보수는 빨간색, 중도와 기타는 회색 계열로 표시한다.
- 경제지는 `style.txt`의 3분류 기준을 따르며, 기타/정부/미분류 출처는 `기타`로 표시한다.
- 성향 배지는 출처 맥락을 돕는 보조 메타데이터이며, verdict 또는 출처 신뢰도 점수로 사용하지 않는다.
- 이번 변경은 공개 API 응답 shape, DB schema, Prisma migration을 변경하지 않는다.

## 2026-04-30

### Today Headlines v1
- 오늘의 헤드라인은 `/headlines` 탭으로 노출한다.
- 수집 대상은 초기 v1에서 코드 설정 파일의 주요 매체 정치/경제 RSS 목록으로 관리한다.
- `/headlines`의 1차 사용자 메뉴는 `정치 / 경제` 카테고리 전환으로 둔다.
- 저장 조회, 실시간 조회, 분석 조회, 내부 수동 수집 API는 `category=politics|economy` 쿼리로 정치 또는 경제 RSS 범위를 지정할 수 있다.
- `/headlines` 화면은 실시간 조회 버튼 대신 날짜 검색으로 저장된 헤드라인을 조회한다.
- 날짜 검색의 최소 선택일은 헤드라인 수집 시작일인 2026-04-30으로 둔다.
- RSS 발행시각은 매체별 제공 여부가 달라 화면에 표시하지 않는다.
- `/headlines` 화면은 선택 날짜/카테고리의 수집 기사 전체를 노출한다.
- 기존 사건별 표현 비교 분석 API는 유지하되, 화면의 기본 탭에서는 제외한다.
- RSS 수집은 NestJS scheduler가 `Asia/Seoul` 기준 매일 01:00에 실행한다.
- 수동 수집은 `POST /api/v1/headlines/internal/scrape`로 제공하고 `HEADLINE_JOB_SECRET` 기반 내부 헤더 검증을 사용한다.
- 실시간 조회는 `GET /api/v1/headlines/live`로 제공하고 DB 저장 없이 RSS를 즉시 조회해 반환한다.
- 저장 범위는 RSS의 제목, 링크, 요약, 발행시각, 매체명, raw RSS item으로 제한하고 기사 본문 HTML은 수집하지 않는다.
- 중복 기준은 `publisher_key + normalized_url` unique로 둔다.
- 오늘의 헤드라인 분석은 저장된 RSS 제목만 기반으로 먼저 로컬 군집화하고, OpenAI structured output은 해당 cluster 후보의 사건명, 짧은 요약, 매체별 표현 차이 정리에만 사용한다.
- 오늘의 헤드라인 분석은 선택 날짜/카테고리의 저장된 전체 RSS 기사를 대상으로 한다.
- 분석 summary는 2~3문장의 개요 문단과 `- ` bullet 3~5개로 주요 흐름, 반복 이슈, 매체별 표현 차이, 불확실성을 설명한다.
- 분석 결과는 사건별 cluster와 매체별 표현 요약으로 저장하며 사실 판정, 매체 신뢰도 점수, 정치 성향 판단을 생성하지 않는다.
- 헤드라인 분석은 `OPENAI_API_KEY`가 없으면 실패시키고 임시 분석 cluster를 생성하지 않는다.

### Query Refinement FactCheck Flag
- `search_route` 값에서 `news`를 제거하고 신규 answer 생성 기준 `supported / unsupported`만 사용한다.
- 한국 정치·경제 뉴스성 check은 `supported`, 지원 범위 밖 check은 `unsupported/out_of_scope`로 처리한다.
- 이 결정의 UI 분기 필드는 2026-05-04 `answerMode` 결정으로 대체되었다.
- `checkType`은 `scheduled_event` 등 내부 결과 계산 힌트로만 유지한다.
- Naver News Search는 query별 `display=8`, `sort=sim`으로 요청한다.
- Naver News Search의 분석 후보는 조선일보, 동아일보, 한국경제, 매일경제, 세계일보, 연합뉴스, 중앙일보, 한국일보, YTN, KBS, MBC, SBS, 한겨레, 경향신문, 오마이뉴스, 프레시안으로 제한한다.

### Naver-Only Source Search
- 신규 answer preview source search에서는 Naver News Search 결과가 부족해도 Tavily Search fallback을 호출하지 않는다.
- Tavily Extract 설정과 client는 후속 본문 추출 확장용으로 유지하되, 후보 부족 보조검색에는 사용하지 않는다.

### Check/Answer Naming Migration
- 제품 및 코드 용어에서 검토 대상 입력 단위는 `check`, 검토 결과 단위는 `answer`로 통일한다.
- 공개 API 경로는 `/api/v1/answers` 기준으로 전환하고, frontend route도 `/answers/[answerId]`를 사용한다.
- Prisma 모델은 `Check`, `AnswerJob`을 사용하고 DB table/column은 `checks`, `answer_jobs`, `check_id`, `answer_job_id`로 전환한다.
- 기존 DB는 rename migration으로 따라오며, 저장된 JSON artifact key/value도 새 명칭으로 변환한다.

## 2026-05-01

### Answers LLM Provider
- answer query refinement, relevance/evidence signal classification, llm_direct direct answer provider는 OpenAI 대신 Perplexity Sonar API를 사용한다.
- Perplexity Sonar 호출은 JSON Schema structured output을 사용하고, direct answer는 Perplexity citations/search_results를 source candidate metadata로 보존한다.
- Perplexity Sonar 호출은 비용 절감을 위해 `sonar`, `search_context_size=low`, `reasoning_effort=low`를 기본값으로 사용한다.
- 오늘의 헤드라인 분석 provider는 별도 변경 전까지 기존 OpenAI structured output 경로를 유지한다.

## 2026-05-02

### Perplexity Provider Disconnect
- 신규 answer 생성의 LLM provider는 OpenAI로 통일하고 Perplexity Sonar 호출 경로는 사용하지 않는다.
- `answerMode=direct_answer` 직접 답변도 OpenAI structured output으로 생성한다.
- `PERPLEXITY_API_KEY`는 신규 런타임 설정에서 제거한다.
- 기존 저장 데이터 호환을 위해 `llm_direct` route parsing과 `perplexity-sonar` source provider 값은 당장 삭제하지 않는다.
