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

# Download the latest umple.jar from GitHub releases
fetch-jar:
	@mkdir -p jars
	@echo "Fetching latest umple.jar from GitHub releases..."
	@gh release download --repo umple/umple --pattern '*.jar' --dir jars --clobber
	@cd jars && JAR=$$(ls -1 umple-*.jar 2>/dev/null | head -1) && \
		if [ -n "$$JAR" ]; then \
			ln -sf "$$JAR" umple.jar && \
			echo "Downloaded $$JAR → jars/umple.jar"; \
		else \
			echo "Error: no umple-*.jar found in release assets" && exit 1; \
		fi
