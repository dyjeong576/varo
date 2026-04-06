# VARO EC2 Single-Server Deployment Checklist

이 문서는 현재 기준 `EC2 1대 + 같은 서버 Postgres + GitHub Actions CI/CD + Route 53` 구조로 `VARO`를 배포하기 위해
내가 해야 할 일을 순서대로 정리한 체크리스트다.

중요한 전제:

- `frontend`, `backend`, `postgres`를 모두 같은 EC2에서 운영한다.
- 도메인은 `www.varocheck.com`, `api.varocheck.com`을 사용한다.
- Postgres는 외부에 공개하지 않는다.
- 로컬 PC에서 Postgres에 접속할 때는 `5432`를 인터넷에 열지 말고 `SSH tunnel`로 붙는다.

운영체제 기준:

- 이 문서는 `Amazon Linux` 기준으로 작성한다.
- `Amazon Linux 2023`이면 `dnf`를 사용한다.
- `Amazon Linux 2`면 같은 명령에서 대부분 `dnf` 대신 `yum`으로 바꾸면 된다.

---

## 1. 최종 목표 상태

배포가 끝나면 아래 상태여야 한다.

- `https://www.varocheck.com` 에서 frontend가 열린다.
- `https://api.varocheck.com/api/v1/health` 가 `200 OK`를 반환한다.
- EC2 안에서 `frontend`, `backend`, `postgres`가 Docker Compose로 같이 뜬다.
- GitHub `main` 브랜치에 push하면 GitHub Actions가 이미지를 빌드하고 EC2에 자동 배포한다.
- 로컬 PC에서 Postgres를 보고 싶을 때는 SSH 터널로만 접속한다.

---

## 2. 먼저 알아둘 것

현재 레포 상태 기준으로 아직 바뀌어야 하는 것:

1. `docker-compose.prod.yml` 에 `postgres` 서비스가 아직 없다.
2. `docs/deployment.md`는 원래 RDS 기준으로 써져 있었고, 이 문서가 그 기준을 대체한다.
3. `backend`의 `DATABASE_URL`은 앞으로 같은 compose 네트워크 안의 `postgres` 서비스를 가리켜야 한다.
4. `5432`는 보안그룹에서 열지 않는다.

즉, 순서는 무조건 아래다.

1. 서버 준비
2. 도메인 연결
3. env 준비
4. 수동 1회 배포 성공
5. 그 다음 자동배포

자동배포를 먼저 붙이면 실패 원인이 너무 많아서 디버깅이 어려워진다.

---

## 3. 해야 할 일 전체 순서

### 3.1 GitHub 저장소 준비

해야 할 일:

1. 이 레포를 GitHub 저장소에 올린다.
2. 기본 브랜치를 `main`으로 맞춘다.
3. GitHub Actions가 켜져 있는지 확인한다.

확인 기준:

- GitHub 저장소가 존재한다.
- `main` 브랜치가 보인다.
- `.github/workflows/ci.yml`, `.github/workflows/cd.yml`가 repo에 있다.

### 3.2 EC2 인스턴스 준비

해야 할 일:

1. Ubuntu EC2 1대를 만든다.
2. Elastic IP를 발급해서 EC2에 붙인다.
3. 이 Elastic IP를 기준으로 Route 53을 연결한다.

권장:

- 작은 규모면 `t3.small` 또는 `t3.medium`
- 디스크는 최소 30GB 이상
- 재부팅해도 IP가 안 바뀌게 반드시 Elastic IP 사용

확인 기준:

- EC2가 `running`
- 고정 공인 IP가 있다
- SSH 접속 가능
- 기본 SSH 사용자명은 보통 `ec2-user`

### 3.3 보안그룹 정리

인바운드는 아래만 둔다.

- `HTTP` `80` `0.0.0.0/0`
- `HTTPS` `443` `0.0.0.0/0`
- `SSH` `22` `내 IP/32`

열면 안 되는 것:

- `3000`
- `4000`
- `5432`

설명:

- `3000`, `4000`은 Nginx 뒤의 내부 포트다.
- `5432`는 로컬 PC에서 직접 인터넷으로 붙는 포트가 아니다.
- 로컬 PC 접속은 SSH 터널로 한다.

확인 기준:

- AWS 보안그룹에 `80/443/22`만 있다.

### 3.4 서버 기본 패키지 설치

해야 할 일:

```bash
sudo dnf update -y
sudo dnf install -y docker nginx certbot python3-certbot-nginx ca-certificates curl
sudo systemctl enable --now docker
sudo systemctl enable --now nginx
sudo usermod -aG docker ec2-user

# 현재 세션에 docker 그룹 반영
newgrp docker

docker --version
docker compose version
nginx -v
```

참고:

- AWS 문서 기준 Amazon Linux 2023의 기본 패키지 매니저는 `dnf`다.
- Amazon Linux 2에서는 같은 명령 흐름을 `yum`으로 바꿔도 된다.
- Docker Compose plugin이 기본 포함되지 않은 경우가 있으면 아래로 확인한다.

```bash
docker compose version || sudo dnf install -y docker-compose-plugin
```

확인 기준:

- `docker --version` 성공
- `docker compose version` 성공
- `nginx -v` 성공

### 3.5 서버 디렉터리 준비

해야 할 일:

```bash
sudo mkdir -p /srv/varo/compose
sudo mkdir -p /srv/varo/env
sudo mkdir -p /srv/varo/nginx
sudo mkdir -p /srv/varo/postgres-data
sudo mkdir -p /var/www/certbot
sudo chown -R ec2-user:ec2-user /srv/varo
```

확인 기준:

- `/srv/varo/compose`
- `/srv/varo/env`
- `/srv/varo/postgres-data`

이 3개가 존재한다.

### 3.6 Route 53 연결

해야 할 일:

Route 53 hosted zone에서 아래 레코드를 만든다.

- `A` 레코드 `www.varocheck.com` -> EC2 Elastic IP
- `A` 레코드 `api.varocheck.com` -> EC2 Elastic IP

확인 기준:

```bash
dig +short www.varocheck.com
dig +short api.varocheck.com
```

두 개 다 EC2 Elastic IP가 나와야 한다.

### 3.7 Google OAuth callback 수정

해야 할 일:

Google Cloud Console에서 승인된 redirect URI를 아래로 맞춘다.

```text
https://api.varocheck.com/api/v1/auth/google/callback
```

확인 기준:

- Google OAuth 설정 화면에 위 URL이 들어 있다.

### 3.8 서버 env 파일 준비

이번 구조에서는 env 파일이 3개 필요하다.

#### `/srv/varo/env/frontend.env`

최소값:

```env
NEXT_PUBLIC_APP_NAME=VARO
NEXT_PUBLIC_APP_TAGLINE=Verified Analysis, Reasoned Opinion
NEXT_PUBLIC_APP_PUBLIC_URL=https://www.varocheck.com
NEXT_PUBLIC_APP_INTENDED_PRODUCTION_HOST=www.varocheck.com
NEXT_PUBLIC_APP_CANONICAL_HOST_STATUS=live
NEXT_PUBLIC_API_BASE_URL=https://api.varocheck.com
NEXT_PUBLIC_APP_ENV=prod
```

#### `/srv/varo/env/backend.env`

중요:

- `DATABASE_URL`은 이제 RDS 주소가 아니다.
- 같은 Docker Compose 네트워크의 `postgres` 서비스를 가리켜야 한다.

예시:

```env
PORT=4000
NODE_ENV=production
APP_ENV=prod
APP_NAME=VARO
APP_TAGLINE=Verified Analysis, Reasoned Opinion
APP_PUBLIC_URL=https://www.varocheck.com
APP_INTENDED_PRODUCTION_HOST=www.varocheck.com
APP_CANONICAL_HOST_STATUS=live
DATABASE_URL=postgresql://varo_app:change-me@postgres:5432/varo?schema=public
API_BASE_URL=https://api.varocheck.com
FRONTEND_BASE_URL=https://www.varocheck.com
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
SESSION_SECRET=replace-with-a-long-random-secret
SESSION_COOKIE_NAME=varo_session
SESSION_TTL_DAYS=30
REVIEW_PROVIDER_MODE=real
OPENAI_API_KEY=replace-me
TAVILY_API_KEY=replace-me
TAVILY_SEARCH_TIMEOUT_MS=40000
TAVILY_EXTRACT_TIMEOUT_MS=80000
```

#### `/srv/varo/env/postgres.env`

예시:

```env
POSTGRES_DB=varo
POSTGRES_USER=varo_app
POSTGRES_PASSWORD=change-me
```

권한:

```bash
chmod 600 /srv/varo/env/frontend.env
chmod 600 /srv/varo/env/backend.env
chmod 600 /srv/varo/env/postgres.env
```

확인 기준:

- env 파일 3개가 다 존재
- `backend.env`의 `DATABASE_URL` 사용자/비밀번호와 `postgres.env` 값이 일치

### 3.9 로컬 PC에서 Postgres 접속 방식 결정

중요:

- `5432`를 보안그룹으로 열면 안 된다.
- 로컬 PC에서는 SSH 터널로 접근한다.

권장 방식:

1. EC2 안의 Postgres 컨테이너는 `127.0.0.1:5432` 또는 내부 docker network로만 둔다.
2. 로컬 PC에서 아래처럼 터널을 연다.

```bash
ssh -i <your-key>.pem -L 5432:127.0.0.1:5432 ec2-user@<EC2_PUBLIC_IP>
```

그 다음 로컬 툴에서 아래로 접속:

- host: `127.0.0.1`
- port: `5432`
- db: `varo`
- user: `varo_app`
- password: `postgres.env`에 넣은 값

확인 기준:

- 로컬 PC에서 DBeaver, TablePlus, psql 중 하나로 접속 성공

### 3.10 Nginx + SSL 준비

해야 할 일:

1. Nginx 설정 파일이 `www`와 `api`를 각각 프록시하도록 준비
2. certbot으로 인증서 발급

명령:

```bash
sudo certbot --nginx -d www.varocheck.com -d api.varocheck.com
sudo certbot renew --dry-run
```

인증서 발급 전 확인:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

확인 기준:

- `https://www.varocheck.com` 접속 가능
- `https://api.varocheck.com` 접속 가능

### 3.11 자동배포 전에 수동 1회 배포

이 단계가 가장 중요하다.

해야 할 일:

1. `docker-compose.prod.yml`에 `postgres` 서비스 추가
2. `backend`는 `depends_on postgres` 또는 health 기반 순서 보장
3. `postgres-data`를 `/srv/varo/postgres-data`에 저장
4. `prisma migrate deploy`가 same-network Postgres에 붙도록 구성
5. 서버에서 수동으로 compose 실행

확인 기준:

- `docker compose ps` 에서 `frontend`, `backend`, `postgres`가 뜬다
- `https://api.varocheck.com/api/v1/health` 200
- `https://www.varocheck.com` 정상 표시

자동배포보다 이게 먼저다.

### 3.12 GitHub Actions Secrets 넣기

GitHub 저장소 `Settings -> Secrets and variables -> Actions` 에 아래를 넣는다.

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`
- `GHCR_PULL_USERNAME`
- `GHCR_PULL_TOKEN`

설명:

- `EC2_HOST`: Elastic IP 또는 연결된 도메인
- `EC2_USER`: Amazon Linux면 보통 `ec2-user`
- `EC2_SSH_KEY`: private key 본문
- `GHCR_PULL_USERNAME`: GHCR에 push/pull할 GitHub 계정명
- `GHCR_PULL_TOKEN`: GHCR에 push/pull할 PAT
- 이 토큰은 최소 `read:packages`, `write:packages` 권한이 있어야 한다.

확인 기준:

- GitHub Secrets 목록에 5개가 다 있음

### 3.13 CI 먼저 확인

해야 할 일:

1. PR을 하나 올린다.
2. `CI` workflow가 아래를 통과하는지 본다.

- frontend lint
- frontend build
- backend build
- backend test
- docker build smoke check

확인 기준:

- `CI` 초록불

### 3.14 CD 마지막에 연결

해야 할 일:

1. `main` 에 push
2. `CD` workflow 실행 확인
3. GHCR 이미지 push 확인
4. EC2 SSH 배포 성공 확인

확인 기준:

- Actions `CD` 성공
- `https://api.varocheck.com/api/v1/health` 응답
- 배포 후 사이트 접속 가능

---

## 4. 지금 당장 내가 해야 할 일

우선순위대로 적으면 이렇다.

1. GitHub 저장소 올리기
2. EC2에 Elastic IP 붙이기
3. 보안그룹을 `80/443/22`만 남기기
4. Docker, Nginx, certbot 설치
5. `/srv/varo/...` 디렉터리 만들기
6. Route 53에서 `www`, `api` A 레코드 연결
7. Google OAuth callback 수정
8. 서버 env 3개 만들기
9. Postgres는 `SSH tunnel`로 붙기로 확정
10. 코드에서 `postgres` 서비스 추가 후 수동 1회 배포
11. 마지막에 GitHub Secrets 넣고 자동배포 켜기

---

## 5. 절대 하면 안 되는 것

- `5432`를 `0.0.0.0/0`로 열기
- 자동배포부터 먼저 붙이기
- RDS 기준 `DATABASE_URL`을 그대로 두기
- EC2 공인 IP가 바뀔 수 있는데 Elastic IP 없이 Route 53 연결하기
- env 파일을 Git에 커밋하기

---

## 6. 완료 판정

아래 6개가 되면 이번 단계는 끝난다.

1. `www.varocheck.com` 접속 성공
2. `api.varocheck.com/api/v1/health` 200
3. `frontend`, `backend`, `postgres` 컨테이너 정상 동작
4. 로컬 PC에서 SSH 터널로 Postgres 접속 성공
5. PR에서 CI 성공
6. `main` push에서 CD 성공
