# Current Task

## 작업명
EC2 단일 서버 기준 production 배포 인프라 구축

## 목표
- 단일 레포 구조를 유지한 채 `frontend`와 `backend`를 개별 Docker image로 배포한다.
- `EC2 1대 + host Nginx + Docker Compose + GHCR + GitHub Actions self-hosted runner` production 경로를 구축한다.
- `www.varocheck.com`과 `api.varocheck.com` 분리 도메인 기준으로 배포 자동화를 준비한다.
- 같은 EC2에서 PostgreSQL을 함께 운영하고, 로컬 PC에서는 SSH tunnel로만 접근한다.
- backend health endpoint와 frontend health route를 추가해 배포 검증 기준을 만든다.

## 이번 작업 범위
- `frontend/Dockerfile`
- `backend/Dockerfile`
- 루트 `docker-compose.prod.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`
- self-hosted runner 기반 CD 구조 정리
- `deploy/nginx/*.conf`
- 루트 `deploy.sh`
- `deploy/env/*.example`
- same-host PostgreSQL 배포 구조 정리
- backend `GET /api/v1/health`
- frontend `/healthz`
- production 배포 문서 정리

## 제외 범위
- ECS, Kubernetes 같은 오케스트레이션 도입
- blue-green / canary 배포
- Terraform 등 IaC 도입
- 멀티 서버 분리 배포
