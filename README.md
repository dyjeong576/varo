# VARO

**Verified Analysis, Reasoned Opinion**

VARO는 한국 정치·경제 뉴스와 관련된 주장이나 사실성 있는 문장을 입력하면, 관련 출처를 수집하고 근거 신호와 해석, 남아 있는 불확실성을 함께 보여주는 웹 서비스입니다. VARO의 목적은 절대적인 진실을 선언하는 것이 아니라, 사용자가 수집된 출처를 기준으로 스스로 판단할 수 있도록 근거와 맥락을 구조화하는 것입니다.

## 왜 VARO인가

온라인에서 빠르게 퍼지는 뉴스와 주장에는 원문, 재인용, 해설, 반박, 후속 정정이 섞여 있습니다. 사용자가 여러 기사를 직접 찾아 비교하려면 시간이 오래 걸리고, AI가 단정적인 결론만 제시하면 어떤 근거를 바탕으로 한 해석인지 확인하기 어렵습니다.

VARO는 결론보다 근거를 먼저 볼 수 있게 설계합니다.

- 어떤 문장이 검토 대상 `check`인지 분리합니다.
- 관련 기사와 출처를 수집하고 메타데이터를 함께 보여줍니다.
- 출처별 스니펫과 evidence signal을 통해 지지, 충돌, 맥락 정보를 정리합니다.
- 상충하는 근거와 부족한 근거를 숨기지 않습니다.
- 결과가 어떤 출처에 기반했는지 원문 링크로 추적할 수 있게 합니다.

## 핵심 경험

1. 사용자가 검토하고 싶은 주장을 입력합니다.
2. 시스템이 한국 정치·경제 뉴스성 check인지 판단합니다.
3. Naver News Search 기반으로 관련 출처를 수집합니다.
4. OpenAI structured output으로 relevance, evidence signal, 요약, 불확실성을 구조화합니다.
5. 결과 화면에서 출처 카드, 근거 요약, 일치·충돌 신호, verdict를 함께 확인합니다.
6. fact-check 대상이 아닌 입력은 출처 기반 verdict를 만들지 않고 OpenAI 직접 답변으로 분리합니다.

## 주요 기능

- **주장 검토**: 사용자가 입력한 check를 기준으로 관련 출처와 근거를 수집합니다.
- **출처 카드**: 매체명, 발행 시각, 링크, 핵심 스니펫, 출처 유형을 표시합니다.
- **근거 중심 결과**: AI 해석과 불확실성을 수집된 출처 기준으로 설명합니다.
- **Verdict**: `Likely True`, `Mixed Evidence`, `Unclear`, `Likely False` 4단계로 표현합니다.
- **오늘의 헤드라인**: 정치·경제 RSS 제목을 사건별로 묶고, 매체별 표현 차이를 비교합니다.
- **인기 질문**: 최근 24시간 동안 관심이 모인 질문을 보여줍니다.
- **히스토리와 알림**: 이전 분석 결과 재진입과 분석 완료 알림을 지원합니다.
- **커뮤니티**: 사용자가 이슈에 대해 게시글과 댓글로 토론할 수 있습니다.

## 기술 구조

VARO는 프론트엔드와 백엔드를 분리한 TypeScript 기반 웹 서비스입니다.

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, App Router, Tailwind CSS 4 |
| Backend | NestJS, TypeScript, REST API, Prisma |
| Database | PostgreSQL |
| Auth | Google OAuth, HttpOnly session cookie |
| Search / AI | Naver News Search, OpenAI structured outputs |
| Infra | Docker Compose, nginx container, certbot, GHCR, GitHub Actions self-hosted runner, Amazon Linux EC2 |

백엔드는 `/api/v1` REST API를 제공하고, answer pipeline에서 check understanding, search planning, source collection, evidence signal classification, answer summary 생성을 처리합니다. 프론트엔드는 모바일 우선의 반응형 화면으로 로그인, 분석 요청, 결과 조회, 인기, 커뮤니티, 히스토리, 알림 경험을 연결합니다.

## 로컬 실행

루트와 각 앱의 의존성을 설치합니다.

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

프론트엔드와 백엔드 env 파일을 준비합니다.

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

백엔드는 PostgreSQL 연결이 필요합니다. `backend/.env`의 `DATABASE_URL`을 로컬 DB에 맞게 설정한 뒤 Prisma client와 migration을 준비합니다.

```bash
npm run prisma:generate --prefix backend
npm run prisma:migrate --prefix backend
```

프론트엔드와 백엔드를 함께 실행합니다.

```bash
npm run dev
```

기본 개발 주소는 아래와 같습니다.

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`

외부 provider를 실제로 사용하려면 `OPENAI_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 등 필요한 값을 `backend/.env`에 설정해야 합니다.

## 문서

- [PRD](./docs/prd.md)
- [Architecture](./docs/architecture.md)
- [Frontend Spec](./docs/frontend-spec.md)
- [Backend Spec](./docs/backend-spec.md)

## 제품 원칙

VARO는 가짜뉴스 탐지기처럼 단정적으로 동작하지 않습니다. 결과는 항상 수집된 출처 기준의 해석이며, 근거가 부족하면 부족하다고 말하고, 출처가 충돌하면 충돌을 그대로 보여주는 것을 기본 원칙으로 삼습니다.
