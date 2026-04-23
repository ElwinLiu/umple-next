#!/usr/bin/env bash
set -Eeuo pipefail

USAGE="Usage: release.sh <deploy-path> <release-tag> <source-sha> <backend-image> <frontend-image> <code-exec-image> <code-runner-image> <collab-image> <lsp-proxy-image>"

DEPLOY_PATH="${1:?$USAGE}"
RELEASE_TAG="${2:?$USAGE}"
SOURCE_SHA="${3:?$USAGE}"
BACKEND_IMAGE="${4:?$USAGE}"
FRONTEND_IMAGE="${5:?$USAGE}"
CODE_EXEC_IMAGE="${6:?$USAGE}"
CODE_RUNNER_IMAGE="${7:?$USAGE}"
COLLAB_IMAGE="${8:?$USAGE}"
LSP_PROXY_IMAGE="${9:?$USAGE}"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    docker compose "$@"
  fi
}

cleanup_docker_storage() {
  echo "==> Pruning unused Docker images..."
  docker image prune -a -f || true

  echo "==> Pruning Docker build cache..."
  docker builder prune -a -f || true
}

require_path() {
  local path="$1"
  local description="$2"

  if [ ! -e "$path" ]; then
    echo "ERROR: Missing ${description} at ${path}"
    exit 1
  fi
}

read_env_value() {
  local key="$1"
  local file="$2"

  if [ ! -f "$file" ]; then
    return 1
  fi

  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2-
}

upsert_env() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp

  tmp="$(mktemp)"
  if [ -f "$file" ]; then
    grep -v "^${key}=" "$file" > "$tmp" || true
  fi
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$file"
}

rollback_release() {
  local exit_code="$1"

  if [ "${ROLLBACK_ARMED:-0}" -ne 1 ]; then
    exit "$exit_code"
  fi

  trap '' ERR
  ROLLBACK_ARMED=0
  echo "==> Release failed. Attempting automatic rollback..."

  if [ -z "${PREVIOUS_BACKEND_IMAGE:-}" ] || [ -z "${PREVIOUS_FRONTEND_IMAGE:-}" ] || [ -z "${PREVIOUS_CODE_EXEC_IMAGE:-}" ] || [ -z "${PREVIOUS_CODE_RUNNER_IMAGE:-}" ] || [ -z "${PREVIOUS_COLLAB_IMAGE:-}" ] || [ -z "${PREVIOUS_LSP_PROXY_IMAGE:-}" ]; then
    echo "WARNING: No previous image references were found in .env. Manual rollback required."
    exit "$exit_code"
  fi

  upsert_env "BACKEND_IMAGE" "$PREVIOUS_BACKEND_IMAGE" .env
  upsert_env "FRONTEND_IMAGE" "$PREVIOUS_FRONTEND_IMAGE" .env
  upsert_env "CODE_EXEC_IMAGE" "$PREVIOUS_CODE_EXEC_IMAGE" .env
  upsert_env "CODE_RUNNER_IMAGE" "$PREVIOUS_CODE_RUNNER_IMAGE" .env
  upsert_env "COLLAB_IMAGE" "$PREVIOUS_COLLAB_IMAGE" .env
  upsert_env "LSP_PROXY_IMAGE" "$PREVIOUS_LSP_PROXY_IMAGE" .env
  upsert_env "DEPLOYED_AT" "$PREVIOUS_DEPLOYED_AT" .env
  upsert_env "DEPLOYED_SOURCE_COMMIT" "$PREVIOUS_DEPLOYED_SOURCE_COMMIT" .env
  upsert_env "DEPLOYED_SOURCE_REF" "$PREVIOUS_DEPLOYED_SOURCE_REF" .env
  upsert_env "RELEASE_TAG" "$PREVIOUS_RELEASE_TAG" .env
  upsert_env "DOCKER_GID" "$DOCKER_GID" .env

  compose -f docker-compose.prod.yml pull || true
  docker pull "$PREVIOUS_CODE_RUNNER_IMAGE" || true
  compose -f docker-compose.prod.yml up -d --remove-orphans || true
  compose -f docker-compose.prod.yml ps || true

  exit "$exit_code"
}

wait_for_backend() {
  local attempts=60

  echo "==> Waiting for backend readiness..."
  for i in $(seq 1 "$attempts"); do
    if compose -f docker-compose.prod.yml exec -T backend wget -q --spider "http://localhost:${BACKEND_PORT}/api/health" 2>/dev/null; then
      echo "Backend ready."
      return 0
    fi

    if [ "$i" -eq "$attempts" ]; then
      echo "ERROR: Backend did not become ready within ${attempts}s"
      compose -f docker-compose.prod.yml logs backend --tail=80
      return 1
    fi

    sleep 1
  done
}

check_frontend() {
  local frontend_check_host="$1"
  local frontend_host_port="$2"
  local frontend_check_url_host="$frontend_check_host"

  case "$frontend_check_url_host" in
    \[*\]) ;;
    *:*) frontend_check_url_host="[$frontend_check_url_host]" ;;
  esac

  echo "==> Checking frontend..."
  if ! curl -sf "http://${frontend_check_url_host}:${frontend_host_port}/" > /dev/null; then
    echo "ERROR: Frontend not responding on ${frontend_check_host}:${frontend_host_port}"
    compose -f docker-compose.prod.yml logs frontend --tail=40
    return 1
  fi
}

cd "$DEPLOY_PATH"

# Two-phase rollback guard: ROLLBACK_ARMED stays 0 during pre-flight checks
# so early failures (missing paths, bad config) exit immediately without
# attempting a rollback. It flips to 1 only after images are pulled and
# services are being restarted — the point where a failed deploy leaves the
# system in a broken state and automatic rollback is worthwhile.
ROLLBACK_ARMED=0
trap 'rollback_release $?' ERR

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required on the deployment host"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is unavailable"
  exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker-compose or docker compose is required on the deployment host"
  exit 1
fi

require_path "$DEPLOY_PATH/docker-compose.prod.yml" "production compose file"
require_path "$DEPLOY_PATH/.env" "deployment env file"
require_path "/usr/local/bin/txl" "TXL binary"
require_path "/usr/local/lib/txl" "TXL runtime directory"
require_path "/var/run/docker.sock" "Docker socket"

mkdir -p "$DEPLOY_PATH/data/models"

ALLOWED_ORIGINS="$(read_env_value "ALLOWED_ORIGINS" .env || true)"
if [ -z "$ALLOWED_ORIGINS" ]; then
  echo "ERROR: ALLOWED_ORIGINS must be set in .env before releasing."
  exit 1
fi

if [ "$ALLOWED_ORIGINS" = "http://localhost:3100" ]; then
  echo "ERROR: Refusing to release with the default localhost ALLOWED_ORIGINS value."
  exit 1
fi

FRONTEND_BIND_HOST="$(read_env_value "FRONTEND_BIND_HOST" .env || true)"
FRONTEND_BIND_HOST="${FRONTEND_BIND_HOST:-127.0.0.1}"
FRONTEND_HOST_PORT="$(read_env_value "FRONTEND_HOST_PORT" .env || true)"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-3100}"
BACKEND_PORT="$(read_env_value "BACKEND_PORT" .env || true)"
BACKEND_PORT="${BACKEND_PORT:-3001}"

FRONTEND_CHECK_HOST="$FRONTEND_BIND_HOST"
if [ "$FRONTEND_CHECK_HOST" = "0.0.0.0" ]; then
  FRONTEND_CHECK_HOST="127.0.0.1"
elif [ "$FRONTEND_CHECK_HOST" = "::" ]; then
  FRONTEND_CHECK_HOST="::1"
fi

DOCKER_GID="$(stat -c '%g' /var/run/docker.sock)"
PREVIOUS_BACKEND_IMAGE="$(read_env_value "BACKEND_IMAGE" .env || true)"
PREVIOUS_FRONTEND_IMAGE="$(read_env_value "FRONTEND_IMAGE" .env || true)"
PREVIOUS_CODE_EXEC_IMAGE="$(read_env_value "CODE_EXEC_IMAGE" .env || true)"
PREVIOUS_CODE_RUNNER_IMAGE="$(read_env_value "CODE_RUNNER_IMAGE" .env || true)"
PREVIOUS_COLLAB_IMAGE="$(read_env_value "COLLAB_IMAGE" .env || true)"
PREVIOUS_LSP_PROXY_IMAGE="$(read_env_value "LSP_PROXY_IMAGE" .env || true)"
PREVIOUS_DEPLOYED_AT="$(read_env_value "DEPLOYED_AT" .env || true)"
PREVIOUS_DEPLOYED_SOURCE_COMMIT="$(read_env_value "DEPLOYED_SOURCE_COMMIT" .env || true)"
PREVIOUS_DEPLOYED_SOURCE_REF="$(read_env_value "DEPLOYED_SOURCE_REF" .env || true)"
PREVIOUS_RELEASE_TAG="$(read_env_value "RELEASE_TAG" .env || true)"
DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

upsert_env "BACKEND_IMAGE" "$BACKEND_IMAGE" .env
upsert_env "FRONTEND_IMAGE" "$FRONTEND_IMAGE" .env
upsert_env "CODE_EXEC_IMAGE" "$CODE_EXEC_IMAGE" .env
upsert_env "CODE_RUNNER_IMAGE" "$CODE_RUNNER_IMAGE" .env
upsert_env "COLLAB_IMAGE" "$COLLAB_IMAGE" .env
upsert_env "LSP_PROXY_IMAGE" "$LSP_PROXY_IMAGE" .env
upsert_env "DEPLOYED_AT" "$DEPLOYED_AT" .env
upsert_env "DEPLOYED_SOURCE_COMMIT" "$SOURCE_SHA" .env
upsert_env "DEPLOYED_SOURCE_REF" "refs/tags/$RELEASE_TAG" .env
upsert_env "RELEASE_TAG" "$RELEASE_TAG" .env
upsert_env "DOCKER_GID" "$DOCKER_GID" .env

echo "==> Releasing images:"
echo "    RELEASE_TAG=$RELEASE_TAG"
echo "    SOURCE_SHA=$SOURCE_SHA"
echo "    BACKEND_IMAGE=$BACKEND_IMAGE"
echo "    FRONTEND_IMAGE=$FRONTEND_IMAGE"
echo "    CODE_EXEC_IMAGE=$CODE_EXEC_IMAGE"
echo "    CODE_RUNNER_IMAGE=$CODE_RUNNER_IMAGE"
echo "    COLLAB_IMAGE=$COLLAB_IMAGE"
echo "    LSP_PROXY_IMAGE=$LSP_PROXY_IMAGE"
echo "    DOCKER_GID=$DOCKER_GID"
echo "    DEPLOYED_AT=$DEPLOYED_AT"
echo "    BACKEND_PORT=$BACKEND_PORT"
echo "    FRONTEND_BIND_HOST=$FRONTEND_BIND_HOST"
echo "    FRONTEND_HOST_PORT=$FRONTEND_HOST_PORT"

cleanup_docker_storage

# Stop containers from any previous compose project name (e.g. after a rename).
# This is harmless if no old project exists.
for old_project in umple-next-prod; do
  if docker ps -a --filter "label=com.docker.compose.project=${old_project}" --format '{{.ID}}' | head -1 | grep -q .; then
    echo "==> Stopping old compose project '${old_project}'..."
    compose -p "$old_project" -f docker-compose.prod.yml down --remove-orphans || true
  fi
done

ROLLBACK_ARMED=1

echo "==> Pulling release images..."
compose -f docker-compose.prod.yml pull
docker pull "$CODE_RUNNER_IMAGE"

echo "==> Restarting services..."
compose -f docker-compose.prod.yml up -d --remove-orphans

wait_for_backend
check_frontend "$FRONTEND_CHECK_HOST" "$FRONTEND_HOST_PORT"

ROLLBACK_ARMED=0

# Do not prune here: CODE_RUNNER_IMAGE is intentionally idle between requests,
# so `docker image prune -a` would remove the image that code-exec needs later.

echo "==> Release complete!"
