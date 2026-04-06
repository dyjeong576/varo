#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=${ROOT_DIR:-/srv/varo}
COMPOSE_DIR="$ROOT_DIR/compose"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.prod.yml"
RELEASE_ENV_FILE="$COMPOSE_DIR/.release.env"
FRONTEND_ENV_FILE=${FRONTEND_ENV_FILE:-$ROOT_DIR/env/frontend.env}
BACKEND_ENV_FILE=${BACKEND_ENV_FILE:-$ROOT_DIR/env/backend.env}
POSTGRES_ENV_FILE=${POSTGRES_ENV_FILE:-$ROOT_DIR/env/postgres.env}

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

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

set -a
. "$RELEASE_ENV_FILE"
set +a

wait_for_postgres() {
  for attempt in {1..20}; do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
      'pg_isready -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null; then
      return 0
    fi

    sleep 3
  done

  echo "Postgres did not become ready in time." >&2
  return 1
}

docker compose -f "$COMPOSE_FILE" up -d postgres
wait_for_postgres

docker compose -f "$COMPOSE_FILE" pull frontend backend
docker compose -f "$COMPOSE_FILE" run --rm backend npm run prisma:deploy
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

for attempt in {1..20}; do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
    'pg_isready -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null \
    && curl --fail --silent http://127.0.0.1:4000/api/v1/health >/dev/null \
    && curl --fail --silent http://127.0.0.1:3000/healthz >/dev/null; then
    echo "Deployment succeeded."
    exit 0
  fi

  sleep 3
done

echo "Deployment health checks failed." >&2
docker compose -f "$COMPOSE_FILE" ps >&2
exit 1
