#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=${ROOT_DIR:-/srv/varo}
COMPOSE_DIR="$ROOT_DIR/compose"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.prod.yml"
RELEASE_ENV_FILE="$COMPOSE_DIR/.release.env"
FRONTEND_ENV_FILE=${FRONTEND_ENV_FILE:-$ROOT_DIR/env/frontend.env}
BACKEND_ENV_FILE=${BACKEND_ENV_FILE:-$ROOT_DIR/env/backend.env}
POSTGRES_ENV_FILE=${POSTGRES_ENV_FILE:-$ROOT_DIR/env/postgres.env}
CERTBOT_ENV_FILE=${CERTBOT_ENV_FILE:-$ROOT_DIR/env/certbot.env}
NGINX_ROOT_DIR=${NGINX_ROOT_DIR:-$ROOT_DIR/nginx}
NGINX_CONF_DIR="$NGINX_ROOT_DIR/conf.d"
NGINX_INCLUDE_DIR="$NGINX_ROOT_DIR/includes"
NGINX_HTTP_TEMPLATE="$NGINX_ROOT_DIR/templates/http-only/default.conf"
NGINX_TLS_TEMPLATE="$NGINX_ROOT_DIR/templates/tls/default.conf"
CERTBOT_WWW_DIR=${CERTBOT_WWW_DIR:-$ROOT_DIR/certbot/www}
CERTBOT_CONF_DIR=${CERTBOT_CONF_DIR:-$ROOT_DIR/certbot/conf}
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
require_file "$CERTBOT_ENV_FILE"
require_file "$NGINX_HTTP_TEMPLATE"
require_file "$NGINX_TLS_TEMPLATE"

mkdir -p \
  "$COMPOSE_DIR" \
  "$NGINX_CONF_DIR" \
  "$NGINX_INCLUDE_DIR" \
  "$CERTBOT_WWW_DIR" \
  "$CERTBOT_CONF_DIR"

cat >"$RELEASE_ENV_FILE" <<EOF
FRONTEND_IMAGE=$FRONTEND_IMAGE
BACKEND_IMAGE=$BACKEND_IMAGE
IMAGE_TAG=$IMAGE_TAG
EOF

chmod 600 "$RELEASE_ENV_FILE"

set -a
. "$RELEASE_ENV_FILE"
. "$CERTBOT_ENV_FILE"
. "$FRONTEND_ENV_FILE"
. "$BACKEND_ENV_FILE"
set +a

require_env CERTBOT_EMAIL
require_env CERTBOT_PRIMARY_DOMAIN
require_env CERTBOT_API_DOMAIN
require_env API_BASE_URL

if [[ -z "${NEXT_PUBLIC_APP_PUBLIC_URL:-}" && -z "${APP_PUBLIC_URL:-}" ]]; then
  echo "Missing public frontend URL in frontend.env or backend.env." >&2
  exit 1
fi

PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_APP_PUBLIC_URL:-$APP_PUBLIC_URL}

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
    ROOT_DIR="$ROOT_DIR" \
    FRONTEND_IMAGE="$FRONTEND_IMAGE" \
    BACKEND_IMAGE="$BACKEND_IMAGE" \
    IMAGE_TAG="$IMAGE_TAG" \
    docker compose -f "$COMPOSE_FILE" "$@"
}

activate_nginx_config() {
  local variant="$1"
  local template_path

  case "$variant" in
    http-only) template_path="$NGINX_HTTP_TEMPLATE" ;;
    tls) template_path="$NGINX_TLS_TEMPLATE" ;;
    *)
      echo "Unknown nginx config variant: $variant" >&2
      exit 1
      ;;
  esac

  find "$NGINX_CONF_DIR" -maxdepth 1 -type f -name '*.conf' -delete
  cp "$template_path" "$NGINX_CONF_DIR/default.conf"
}

validate_nginx_config() {
  compose run --rm --no-deps nginx nginx -t >/dev/null
}

reload_nginx() {
  compose exec -T nginx nginx -t >/dev/null
  compose exec -T nginx nginx -s reload >/dev/null
}

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

wait_for_container_check() {
  local service="$1"
  local description="$2"
  local command="$3"

  for attempt in {1..20}; do
    if compose exec -T "$service" sh -lc "$command" >/dev/null; then
      return 0
    fi

    sleep 3
  done

  echo "$service did not become healthy: $description" >&2
  return 1
}

wait_for_public_url() {
  local url="$1"

  for attempt in {1..20}; do
    if curl --fail --silent --show-error "$url" >/dev/null; then
      return 0
    fi

    sleep 3
  done

  echo "Public URL did not become healthy: $url" >&2
  return 1
}

has_certificate() {
  [[ -f "$CERTBOT_CONF_DIR/live/$CERTBOT_PRIMARY_DOMAIN/fullchain.pem" ]] \
    && [[ -f "$CERTBOT_CONF_DIR/live/$CERTBOT_PRIMARY_DOMAIN/privkey.pem" ]]
}

issue_initial_certificate() {
  compose run --rm certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$CERTBOT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d "$CERTBOT_PRIMARY_DOMAIN" \
    -d "$CERTBOT_API_DOMAIN"
}

renew_certificate() {
  compose run --rm certbot renew \
    --webroot \
    --webroot-path /var/www/certbot \
    --non-interactive \
    --quiet
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

compose up -d postgres
wait_for_postgres

activate_nginx_config http-only
validate_nginx_config
compose up -d nginx

if ! has_certificate; then
  issue_initial_certificate
fi

activate_nginx_config tls
reload_nginx
renew_certificate
reload_nginx

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

wait_for_container_check backend "http://127.0.0.1:4000/api/v1/health" \
  'node -e "fetch(\"http://127.0.0.1:4000/api/v1/health\").then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"'
wait_for_container_check frontend "http://127.0.0.1:3000/healthz" \
  'node -e "fetch(\"http://127.0.0.1:3000/healthz\").then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"'
wait_for_container_check nginx "http://127.0.0.1/" 'wget -q --spider http://127.0.0.1/ || exit 1'
wait_for_public_url "${API_BASE_URL%/}/health"
wait_for_public_url "${PUBLIC_FRONTEND_URL%/}/healthz"

echo "Deployment succeeded."
