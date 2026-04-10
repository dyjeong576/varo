# VARO Deployment

## 1. 문서 목적

이 문서는 VARO의 현재 production 배포 기준을 정리한다. 기준 범위는 `tasks/current-task.md`에 맞춰 아래까지만 포함한다.

- `Amazon Linux 2023 ARM64` EC2 1대
- Docker Compose 기반 `nginx`, `certbot`, `frontend`, `backend`, `postgres`
- GHCR 이미지 저장소
- GitHub Actions self-hosted runner 기반 CD
- `www.varocheck.com` / `api.varocheck.com` 분리 도메인

이 문서는 현재 레포의 실제 파일 기준으로 작성한다. 따라서 장기 아키텍처 문서에 등장하는 `Redis`, 별도 `worker`, IaC, 멀티 서버 운영은 여기 포함하지 않는다.

## 2. 현재 production 토폴로지

```text
사용자 브라우저
  -> Route 53
  -> EC2 (Amazon Linux 2023 ARM64)
      -> nginx container (:80, :443)
          -> www.varocheck.com -> frontend container (:3000)
          -> api.varocheck.com -> backend container (:4000)
      -> certbot container
      -> postgres container
      -> GitHub Actions self-hosted runner
          -> GHCR build/push
          -> /srv/varo/compose/deploy.sh 실행
```

운영 원칙:

- 외부에 공개하는 포트는 `22`, `80`, `443`만 사용한다.
- `frontend`, `backend`, `postgres`는 host port를 열지 않고 compose 내부 네트워크로만 통신한다.
- reverse proxy와 TLS termination은 host Nginx가 아니라 `nginx` 컨테이너가 담당한다.
- 인증서 발급과 갱신은 `certbot` 컨테이너가 `webroot` 방식으로 처리한다.
- production deploy는 immutable `short SHA` 이미지 태그를 사용하고, 성공 후 `prod` alias를 갱신한다.

## 3. 레포 기준 운영 파일

- Compose 파일: `/srv/varo/compose/docker-compose.prod.yml`
- 배포 스크립트: `/srv/varo/compose/deploy.sh`
- release 메타데이터: `/srv/varo/compose/.release.env`
- frontend env: `/srv/varo/env/frontend.env`
- backend env: `/srv/varo/env/backend.env`
- postgres env: `/srv/varo/env/postgres.env`
- nginx 활성 설정: `/srv/varo/nginx/conf.d/default.conf`
- nginx include: `/srv/varo/nginx/includes/proxy-common.conf`
- nginx 템플릿:
  - `/srv/varo/nginx/templates/http-only/default.conf`
  - `/srv/varo/nginx/templates/tls/default.conf`
- certbot webroot: `/srv/varo/certbot/www`
- certbot cert storage: `/srv/varo/certbot/conf`
- postgres data: `/srv/varo/postgres-data`

중요:

- host에 Nginx나 certbot을 계속 운영하지 않는다.
- repo의 `docker-compose.prod.yml`, `deploy.sh`, `ops/nginx/*`는 CD 과정에서 `/srv/varo` 아래로 복사된다.
- 운영 시 compose 기준 루트는 `/srv/varo`다.

## 4. 서버 1회 준비

### 4.1 패키지 설치

```bash
sudo dnf update -y
sudo dnf install -y docker ca-certificates curl git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
docker --version
```

Amazon Linux 2023에서 `docker compose` 플러그인이 기본 제공되지 않으면 별도 설치한다.

```bash
COMPOSE_VERSION=v2.27.0
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
sudo -H -u ec2-user docker compose version
```

### 4.2 운영 디렉터리 생성

```bash
sudo mkdir -p /srv/varo/compose
sudo mkdir -p /srv/varo/env
sudo mkdir -p /srv/varo/nginx/conf.d
sudo mkdir -p /srv/varo/nginx/includes
sudo mkdir -p /srv/varo/nginx/templates/http-only
sudo mkdir -p /srv/varo/nginx/templates/tls
sudo mkdir -p /srv/varo/certbot/www
sudo mkdir -p /srv/varo/certbot/conf
sudo mkdir -p /srv/varo/postgres-data
sudo chown -R ec2-user:ec2-user /srv/varo
```

### 4.3 host Nginx 정리

컨테이너 Nginx가 `80`, `443`을 bind 하므로 host Nginx가 켜져 있으면 배포가 실패한다.

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

기존 host certbot 또는 `/etc/letsencrypt` 인증서를 재사용할 때만 아래처럼 복사한다.

```bash
sudo cp -R /etc/letsencrypt/. /srv/varo/certbot/conf/
sudo chown -R ec2-user:ec2-user /srv/varo/certbot/conf
```

## 5. 네트워크와 DNS

### 5.1 Security Group

허용:

- `22/tcp` -> 운영자 고정 IP
- `80/tcp` -> `0.0.0.0/0`
- `443/tcp` -> `0.0.0.0/0`

열지 말 것:

- `3000`
- `4000`
- `5432`

### 5.2 Route 53

- `A` `www.varocheck.com` -> EC2 Elastic IP
- `A` `api.varocheck.com` -> EC2 Elastic IP

### 5.3 Google OAuth

승인된 redirect URI:

```text
https://api.varocheck.com/api/v1/auth/google/callback
```

## 6. env 파일 규칙

### 6.1 frontend env

경로: `/srv/varo/env/frontend.env`

```env
NEXT_PUBLIC_APP_NAME=VARO
NEXT_PUBLIC_APP_TAGLINE=Verified Analysis, Reasoned Opinion
NEXT_PUBLIC_APP_PUBLIC_URL=https://www.varocheck.com
NEXT_PUBLIC_APP_INTENDED_PRODUCTION_HOST=www.varocheck.com
NEXT_PUBLIC_APP_CANONICAL_HOST_STATUS=live
NEXT_PUBLIC_API_BASE_URL=https://api.varocheck.com
INTERNAL_API_BASE_URL=http://backend:4000
NEXT_PUBLIC_APP_ENV=prod
```

### 6.2 backend env

경로: `/srv/varo/env/backend.env`

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
SESSION_COOKIE_DOMAIN=varocheck.com
SESSION_TTL_DAYS=30
REVIEW_PROVIDER_MODE=real
OPENAI_API_KEY=replace-me
TAVILY_API_KEY=replace-me
TAVILY_SEARCH_TIMEOUT_MS=40000
TAVILY_EXTRACT_TIMEOUT_MS=80000
CERTBOT_EMAIL=ops@varocheck.com
# optional override
# CERTBOT_PRIMARY_DOMAIN=www.varocheck.com
# CERTBOT_API_DOMAIN=api.varocheck.com
```

주의:

- `API_BASE_URL`은 backend host 기준 public base URL이므로 `https://api.varocheck.com` 형태로 맞춘다.
- `SESSION_COOKIE_DOMAIN=varocheck.com`으로 두 서브도메인에서 세션 쿠키를 공유한다.
- `REVIEW_PROVIDER_MODE=real`이 production 기본값이다.
- `CERTBOT_EMAIL`은 최초 발급 시 필수다.

### 6.3 postgres env

경로: `/srv/varo/env/postgres.env`

```env
POSTGRES_DB=varo
POSTGRES_USER=varo_app
POSTGRES_PASSWORD=change-me
```

### 6.4 권한

```bash
chmod 600 /srv/varo/env/frontend.env
chmod 600 /srv/varo/env/backend.env
chmod 600 /srv/varo/env/postgres.env
```

## 7. Nginx / Certbot 규칙

현재 템플릿 파일은 레포의 아래 경로를 사용한다.

- `ops/nginx/includes/proxy-common.conf`
- `ops/nginx/templates/http-only/default.conf`
- `ops/nginx/templates/tls/default.conf`

동작 방식:

- HTTP-only 템플릿은 `www`, `api` 모두 80 포트에서 reverse proxy와 ACME challenge를 처리한다.
- TLS 템플릿은 80 포트를 HTTPS redirect로 돌리고, 443에서 `frontend`, `backend`로 reverse proxy 한다.
- `_healthz`는 Nginx 컨테이너 자체 상태 확인용이다.
- 현재 TLS 템플릿은 `www.varocheck.com` 경로의 인증서 파일을 사용한다.
  - `deploy.sh`는 `certbot certonly -d www.varocheck.com -d api.varocheck.com` 형태로 SAN 인증서를 발급한다.
  - 따라서 인증서 저장 경로는 primary domain인 `www.varocheck.com` 아래를 기준으로 본다.

## 8. Docker Compose 서비스

현재 `docker-compose.prod.yml`은 아래 서비스만 포함한다.

- `postgres`
- `frontend`
- `backend`
- `nginx`
- `certbot`

health check:

- `frontend` -> `http://127.0.0.1:3000/healthz`
- `backend` -> `http://127.0.0.1:4000/api/v1/health`
- `nginx` -> `http://127.0.0.1/_healthz`
- `postgres` -> `pg_isready`

현재 문서 범위에서 `redis`, `worker`는 production compose에 포함하지 않는다.

## 9. Self-hosted runner 준비

`cd.yml`의 deploy job은 아래 label을 모두 요구한다.

- `self-hosted`
- `Linux`
- `ARM64`
- `varo-prod`

설치 예시:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-arm64.tar.gz -L <GitHub runner download URL>
tar xzf actions-runner-linux-arm64.tar.gz
./config.sh --url <repo-url> --token <runner-registration-token> --labels varo-prod
sudo ./svc.sh install ec2-user
sudo ./svc.sh start
sudo -H -u ec2-user docker compose version
```

## 10. GitHub Actions와 secrets

### 10.1 CI

`ci.yml`은 아래를 수행한다.

- frontend: `npm ci`, `lint`, `build`
- backend: `npm ci`, `prisma:generate`, `build`, `test`
- docker smoke: frontend/backend 이미지 빌드 확인

### 10.2 CD

`cd.yml`은 `main` push 시 아래 순서로 동작한다.

1. 변경 파일을 보고 `frontend_changed`, `backend_changed`를 계산한다.
2. 필요한 서비스만 ARM64 이미지를 build 하고 GHCR에 push 한다.
3. `/srv/varo` 아래 운영 자산을 동기화한다.
4. `deploy.sh`를 실행해 필요한 서비스만 pull / migrate / restart 한다.
5. public health check를 통과하면 `prod` alias 태그를 갱신한다.

### 10.3 필요한 GitHub secrets

- `GHCR_PULL_USERNAME`
- `GHCR_PULL_TOKEN`

권장 권한:

- `read:packages`
- `write:packages`

주의:

- workflow secret 이름은 `GHCR_PULL_USERNAME`, `GHCR_PULL_TOKEN`이다.
- `deploy.sh` 내부에서는 이 값을 `GHCR_USERNAME`, `GHCR_TOKEN`으로 받아 `docker login ghcr.io`를 실행한다.

## 11. 실제 배포 순서

`/srv/varo/compose/deploy.sh` 기준 실제 순서는 아래와 같다.

1. `docker login ghcr.io`
2. `postgres` 기동
3. `pg_isready`로 DB readiness 확인
4. HTTP-only Nginx 설정 활성화
5. `nginx -t` 검증 후 `nginx` 컨테이너 기동
6. 인증서가 없으면 `certbot certonly --webroot` 실행
7. TLS Nginx 설정 활성화
8. `nginx -s reload`
9. `certbot renew --webroot` 실행
10. 변경된 앱 이미지 pull
11. backend 대상 배포면 `npm run prisma:deploy` 실행 후 backend 재기동
12. frontend 대상 배포면 frontend 재기동
13. container health check 확인
14. public URL health check 확인
15. 성공 시 workflow가 GHCR `prod` alias를 갱신

변경 감지 규칙:

- `frontend/*` 변경 -> frontend만 배포
- `backend/*` 변경 -> backend만 배포
- 아래 공용 파일 변경 -> frontend/backend 둘 다 배포
  - `ops/nginx/*`
  - `docker-compose.prod.yml`
  - `deploy.sh`
  - `.dockerignore`
  - `.github/workflows/cd.yml`

## 12. 배포 검증 기준

내부 검증:

- frontend container: `GET /healthz`
- backend container: `GET /api/v1/health`
- nginx container: `GET /_healthz`

public 검증:

- `https://www.varocheck.com/healthz`
- `https://api.varocheck.com/api/v1/health`

현재 구현 기준 응답:

- frontend `/healthz` -> `{"status":"ok","service":"frontend"}`
- backend `/api/v1/health` -> app + PostgreSQL 연결 확인 후 `status`, `service`, `database`, `checkedAt` 반환

## 13. 운영 점검 명령

```bash
sudo -H -u ec2-user docker compose -f /srv/varo/compose/docker-compose.prod.yml ps
sudo -H -u ec2-user docker compose -f /srv/varo/compose/docker-compose.prod.yml logs --tail=200 nginx
sudo -H -u ec2-user docker compose -f /srv/varo/compose/docker-compose.prod.yml logs --tail=200 backend
sudo -H -u ec2-user docker compose -f /srv/varo/compose/docker-compose.prod.yml logs --tail=200 frontend
curl -I https://www.varocheck.com/healthz
curl -I https://api.varocheck.com/api/v1/health
```

DB 확인은 외부 포트를 열지 않고 EC2 내부에서 수행한다.

```bash
sudo -H -u ec2-user docker compose -f /srv/varo/compose/docker-compose.prod.yml exec postgres \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## 14. 현재 범위의 제한사항

- 현재 production compose에는 `Redis`, 별도 `worker`가 아직 포함되지 않는다.
- PostgreSQL은 같은 EC2 내부 컨테이너로 운영하므로 고가용성은 제공하지 않는다.
- blue-green, canary, IaC, multi-region, managed database는 현재 문서 범위 밖이다.
- 로컬 PC용 DB 직접 접속 절차는 현재 compose가 host `5432`를 publish 하지 않으므로 기본 운영 문서에 포함하지 않는다. 기본 점검은 EC2 shell + `docker compose exec postgres` 기준으로 수행한다.
