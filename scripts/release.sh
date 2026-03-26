#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_PATH="${1:?Usage: release.sh <deploy-path> <backend-image> <frontend-image> <code-exec-image>}"
BACKEND_IMAGE="${2:?Usage: release.sh <deploy-path> <backend-image> <frontend-image> <code-exec-image>}"
FRONTEND_IMAGE="${3:?Usage: release.sh <deploy-path> <backend-image> <frontend-image> <code-exec-image>}"
CODE_EXEC_IMAGE="${4:?Usage: release.sh <deploy-path> <backend-image> <frontend-image> <code-exec-image>}"

compose() {
  if command -v docker-compose >/dev/null 2>&1; then
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

  if [ -z "${PREVIOUS_BACKEND_IMAGE:-}" ] || [ -z "${PREVIOUS_FRONTEND_IMAGE:-}" ] || [ -z "${PREVIOUS_CODE_EXEC_IMAGE:-}" ]; then
    echo "WARNING: No previous image references were found in .env. Manual rollback required."
    exit "$exit_code"
  fi

  upsert_env "BACKEND_IMAGE" "$PREVIOUS_BACKEND_IMAGE" .env
  upsert_env "FRONTEND_IMAGE" "$PREVIOUS_FRONTEND_IMAGE" .env
  upsert_env "CODE_EXEC_IMAGE" "$PREVIOUS_CODE_EXEC_IMAGE" .env
  upsert_env "DOCKER_GID" "$DOCKER_GID" .env

  compose -f docker-compose.prod.yml pull || true
  compose -f docker-compose.prod.yml up -d --remove-orphans || true
  compose -f docker-compose.prod.yml ps || true

  exit "$exit_code"
}

wait_for_backend() {
  local attempts=60

  echo "==> Waiting for backend readiness..."
  for i in $(seq 1 "$attempts"); do
    if compose -f docker-compose.prod.yml exec -T backend wget -q --spider http://localhost:3001/api/health 2>/dev/null; then
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
  echo "==> Checking frontend..."
  if ! curl -sf http://localhost:3100/ > /dev/null; then
    echo "ERROR: Frontend not responding on host port 3100"
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

DOCKER_GID="$(stat -c '%g' /var/run/docker.sock)"
PREVIOUS_BACKEND_IMAGE="$(read_env_value "BACKEND_IMAGE" .env || true)"
PREVIOUS_FRONTEND_IMAGE="$(read_env_value "FRONTEND_IMAGE" .env || true)"
PREVIOUS_CODE_EXEC_IMAGE="$(read_env_value "CODE_EXEC_IMAGE" .env || true)"

upsert_env "BACKEND_IMAGE" "$BACKEND_IMAGE" .env
upsert_env "FRONTEND_IMAGE" "$FRONTEND_IMAGE" .env
upsert_env "CODE_EXEC_IMAGE" "$CODE_EXEC_IMAGE" .env
upsert_env "DOCKER_GID" "$DOCKER_GID" .env

echo "==> Releasing images:"
echo "    BACKEND_IMAGE=$BACKEND_IMAGE"
echo "    FRONTEND_IMAGE=$FRONTEND_IMAGE"
echo "    CODE_EXEC_IMAGE=$CODE_EXEC_IMAGE"
echo "    DOCKER_GID=$DOCKER_GID"

cleanup_docker_storage

ROLLBACK_ARMED=1

echo "==> Pulling release images..."
compose -f docker-compose.prod.yml pull

echo "==> Restarting services..."
compose -f docker-compose.prod.yml up -d --remove-orphans

wait_for_backend
check_frontend

ROLLBACK_ARMED=0

cleanup_docker_storage

echo "==> Release complete!"
