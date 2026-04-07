#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=${ROOT_DIR:-/srv/varo}
COMPOSE_DIR="$ROOT_DIR/compose"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.prod.yml"
RELEASE_ENV_FILE="$COMPOSE_DIR/.release.env"
FRONTEND_ENV_FILE=${FRONTEND_ENV_FILE:-$ROOT_DIR/env/frontend.env}
BACKEND_ENV_FILE=${BACKEND_ENV_FILE:-$ROOT_DIR/env/backend.env}
POSTGRES_ENV_FILE=${POSTGRES_ENV_FILE:-$ROOT_DIR/env/postgres.env}
DEPLOY_USER=${SUDO_USER:-$(id -un)}
DEPLOY_FRONTEND=${DEPLOY_FRONTEND:-true}
DEPLOY_BACKEND=${DEPLOY_BACKEND:-true}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
}

require_env FRONTEND_IMAGE
require_env BACKEND_IMAGE
require_env IMAGE_TAG
require_env GHCR_USERNAME
require_env GHCR_TOKEN

require_file "$COMPOSE_FILE"
require_file "$FRONTEND_ENV_FILE"
require_file "$BACKEND_ENV_FILE"
require_file "$POSTGRES_ENV_FILE"

mkdir -p "$COMPOSE_DIR"

cat >"$RELEASE_ENV_FILE" <<EOF
FRONTEND_IMAGE=$FRONTEND_IMAGE
BACKEND_IMAGE=$BACKEND_IMAGE
IMAGE_TAG=$IMAGE_TAG
EOF

chmod 600 "$RELEASE_ENV_FILE"

set -a
. "$RELEASE_ENV_FILE"
set +a

run_as_deploy_user() {
  if [[ -n "${SUDO_USER:-}" ]]; then
    sudo -H -u "$DEPLOY_USER" "$@"
    return
  fi

  "$@"
}

normalize_bool() {
  local value="${1,,}"

  case "$value" in
    true|1|yes|y|on) echo "true" ;;
    false|0|no|n|off) echo "false" ;;
    *)
      echo "Invalid boolean value: $1" >&2
      exit 1
      ;;
  esac
}

compose() {
  run_as_deploy_user env \
    FRONTEND_IMAGE="$FRONTEND_IMAGE" \
    BACKEND_IMAGE="$BACKEND_IMAGE" \
    IMAGE_TAG="$IMAGE_TAG" \
    docker compose -f "$COMPOSE_FILE" "$@"
}

echo "Using deploy user: $DEPLOY_USER"
echo "Using compose command: docker compose"
printf '%s\n' "$GHCR_TOKEN" | run_as_deploy_user docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

DEPLOY_FRONTEND=$(normalize_bool "$DEPLOY_FRONTEND")
DEPLOY_BACKEND=$(normalize_bool "$DEPLOY_BACKEND")

if [[ "$DEPLOY_FRONTEND" != "true" && "$DEPLOY_BACKEND" != "true" ]]; then
  echo "Nothing to deploy."
  exit 0
fi

wait_for_postgres() {
  for attempt in {1..20}; do
    if compose exec -T postgres sh -lc \
      'pg_isready -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null; then
      return 0
    fi

    sleep 3
  done

  echo "Postgres did not become ready in time." >&2
  return 1
}

compose up -d postgres
wait_for_postgres

services_to_pull=()

if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  services_to_pull+=(frontend)
fi

if [[ "$DEPLOY_BACKEND" == "true" ]]; then
  services_to_pull+=(backend)
fi

compose pull "${services_to_pull[@]}"

if [[ "$DEPLOY_BACKEND" == "true" ]]; then
  compose run --rm backend npm run prisma:deploy
  compose up -d backend
fi

if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  compose up -d frontend
fi

for attempt in {1..20}; do
  if compose exec -T postgres sh -lc \
    'pg_isready -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null \
    && curl --fail --silent http://127.0.0.1:4000/api/v1/health >/dev/null \
    && curl --fail --silent http://127.0.0.1:3000/healthz >/dev/null; then
    echo "Deployment succeeded."
    exit 0
  fi

  sleep 3
done

echo "Deployment health checks failed." >&2
compose ps >&2
exit 1
