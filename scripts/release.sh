#!/usr/bin/env bash
set -euo pipefail

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

require_path() {
  local path="$1"
  local description="$2"

  if [ ! -e "$path" ]; then
    echo "ERROR: Missing ${description} at ${path}"
    exit 1
  fi
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
      exit 1
    fi

    sleep 1
  done
}

cd "$DEPLOY_PATH"

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
require_path "/usr/local/bin/txl" "TXL binary"
require_path "/usr/local/lib/txl" "TXL runtime directory"

mkdir -p "$DEPLOY_PATH/data/models"

# Create .env with defaults if it doesn't exist.
if [ ! -f .env ]; then
  echo "ALLOWED_ORIGINS=http://localhost:3100" > .env
  echo "WARNING: Created .env with default ALLOWED_ORIGINS. Update it for production."
fi

upsert_env "BACKEND_IMAGE" "$BACKEND_IMAGE" .env
upsert_env "FRONTEND_IMAGE" "$FRONTEND_IMAGE" .env
upsert_env "CODE_EXEC_IMAGE" "$CODE_EXEC_IMAGE" .env

echo "==> Releasing images:"
echo "    BACKEND_IMAGE=$BACKEND_IMAGE"
echo "    FRONTEND_IMAGE=$FRONTEND_IMAGE"
echo "    CODE_EXEC_IMAGE=$CODE_EXEC_IMAGE"

echo "==> Pulling release images..."
compose -f docker-compose.prod.yml pull

echo "==> Restarting services..."
compose -f docker-compose.prod.yml up -d --remove-orphans

wait_for_backend

echo "==> Checking frontend..."
if ! curl -sf http://localhost:3100/ > /dev/null; then
  echo "ERROR: Frontend not responding on host port 3100"
  compose -f docker-compose.prod.yml logs frontend --tail=40
  exit 1
fi

echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Release complete!"
