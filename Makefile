.PHONY: dev dev-backend dev-frontend install build up up-prod down logs logs-backend clean tidy fetch-jar test-e2e test-e2e-live test-e2e-ui

# ── Development ──

# Start everything: backend in Docker, frontend with bun (hot reload)
dev:
	@echo "Starting backend (Docker)..."
	docker-compose up -d --build
	@echo ""
	@echo "Starting frontend (bun dev server with HMR)..."
	cd frontend && bun run dev

# Start only the backend services (Docker with Air hot reload)
dev-backend:
	docker-compose up -d --build

# Start only the frontend (bun dev server with HMR)
dev-frontend:
	cd frontend && bun run dev

# Install frontend dependencies
install:
	cd frontend && bun install

# Frontend Playwright tests (mocked backend)
test-e2e:
	cd frontend && bun run test:e2e

# Frontend Playwright tests against the live backend stack
test-e2e-live:
	cd frontend && bun run test:e2e:live

# Interactive Playwright runner for local debugging
test-e2e-ui:
	cd frontend && bun run test:e2e:ui

# ── Production ──

# Build all Docker images (production)
build:
	docker-compose -f docker-compose.prod.yml build

# Start production stack
up-prod:
	docker-compose -f docker-compose.prod.yml up -d --build

# ── Operations ──

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Backend logs only
logs-backend:
	docker-compose logs -f backend

# Clean up
clean:
	docker-compose down -v
	rm -rf data/models/tmp*

# Tidy Go modules
tidy:
	cd backend && go mod tidy

# ── Jar Management ──

# Download the latest umplesync.jar from GitHub releases
fetch-jar:
	@mkdir -p jars
	@echo "Fetching umplesync.jar from GitHub releases..."
	@gh release download jars/v1.36.0 --pattern 'umplesync.jar' --dir jars --clobber
	@echo "Downloaded jars/umplesync.jar"
