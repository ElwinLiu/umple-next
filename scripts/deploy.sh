#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${1:?Usage: deploy.sh <deploy-path>}"
cd "$DEPLOY_PATH"

# Create .env with defaults if it doesn't exist
if [ ! -f .env ]; then
  echo "ALLOWED_ORIGINS=http://localhost:3100" > .env
  echo "WARNING: Created .env with default ALLOWED_ORIGINS — update for production"
fi

echo "==> Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

echo "==> Restarting services..."
docker-compose -f docker-compose.prod.yml up -d --remove-orphans

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

echo "==> Checking frontend..."
curl -sf http://localhost:3100/ > /dev/null || {
  echo "ERROR: Frontend not responding on host port 3100"
  docker-compose -f docker-compose.prod.yml logs frontend --tail=20
  exit 1
}

echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Deploy complete!"
