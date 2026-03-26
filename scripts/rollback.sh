#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${1:?Usage: rollback.sh <deploy-path> <tag> <image-prefix>}"
TAG="${2:?Usage: rollback.sh <deploy-path> <tag> <image-prefix>}"
PREFIX="${3:?Usage: rollback.sh <deploy-path> <tag> <image-prefix>}"

cd "$DEPLOY_PATH"

echo "==> Rolling back to tag: $TAG"

cat > docker-compose.override.yml <<EOF
services:
  backend:
    image: ${PREFIX}/backend:${TAG}
  frontend:
    image: ${PREFIX}/frontend:${TAG}
  code-exec:
    image: ${PREFIX}/code-exec:${TAG}
EOF

docker-compose -f docker-compose.prod.yml -f docker-compose.override.yml pull
docker-compose -f docker-compose.prod.yml -f docker-compose.override.yml up -d --remove-orphans

echo "==> Waiting for backend health..."
for i in $(seq 1 30); do
  if docker-compose -f docker-compose.prod.yml exec -T backend wget -q --spider http://localhost:3001/api/health 2>/dev/null; then
    echo "Backend healthy!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Backend did not become healthy within 30s"
    docker-compose -f docker-compose.prod.yml logs backend --tail=50
    exit 1
  fi
  sleep 1
done

echo "==> Rollback complete!"
docker-compose -f docker-compose.prod.yml ps
