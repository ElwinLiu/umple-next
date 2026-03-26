## Project Overview

Rewrite of UmpleOnline from legacy stack (PHP, jQuery) to modern stack. Old repo: `~/code/umple/`

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite, CodeMirror 6, ReactFlow, Zustand
- **Runtime**: Bun — use `bun install`, `bun run dev`, `bun run build`
- **Backend**: Go 1.22 (Chi router), communicates with umple.jar (Java) via TCP and Graphviz
- **Code Exec**: Node.js service for running compiled code (`code-exec/`)

## Domain & Port Mapping
| Service | Dev Port | Prod Port |
|---------|----------|-----------|
| Frontend | 3200 (Vite) | 3100 (nginx in Docker) |
| Backend API | 3001 | 3001 |

In dev, Vite proxies `/api/*` to `http://localhost:3001`. In prod, the frontend nginx container proxies `/api/*` to the backend container.

## Development Workflow

### Starting dev environment

```
make dev          # Starts backend (Docker) then frontend (bun dev)
```

Or separately:
```
make dev-backend   # Docker: backend (Go + Air)
make dev-frontend  # bun run dev (Vite HMR on port 3100)
```

### Frontend changes

Frontend uses Vite HMR — **changes are instant, no action needed**. Just ensure the dev server is running (`make dev-frontend` or `bun run dev` from `frontend/`).

### Backend changes

Backend runs in Docker with **Air** (Go hot-reloader). When you edit any `.go` file, Air detects the change and rebuilds automatically (~1-2s). No manual restart needed.

If you add new Go dependencies: run `docker-compose exec backend go mod tidy`.

### When you DO need to rebuild

- Changed `Dockerfile.dev` or `docker-compose.yml` → `docker-compose up -d --build`
- Changed `package.json` (new frontend deps) → `bun install`
- First time setup → `make fetch-jar && make install && make dev`

## Key Commands

| Command | When to use |
|---------|-------------|
| `make dev` | Start full dev environment |
| `make test-e2e` | Run mocked Playwright frontend smoke tests |
| `make test-e2e-live` | Run Playwright against the live backend stack |
| `make test-e2e-ui` | Open Playwright UI for local debugging |
| `make down` | Stop all Docker services |
| `make logs` | Tail all service logs |
| `make logs-backend` | Tail backend logs only |
| `make up-prod` | Deploy production (all services in Docker) |
| `make tidy` | Run `go mod tidy` for backend |
| `make clean` | Stop services + remove temp model data |
| `make fetch-jar` | Download latest umple.jar from GitHub releases |

## Playwright

Playwright tests live in `frontend/tests/e2e/`.

Use:

- `cd frontend && bun run test:e2e` for the default mocked frontend smoke tests
- `cd frontend && bun run test:e2e:live` only when the backend stack is already running and you want a real integration check
- `cd frontend && bun run test:e2e:ui` for local interactive debugging

When writing tests:

- Default to mocked `/api/*` responses for frontend verification; keep tests deterministic and fast
- Add or reuse stable `data-testid` hooks for key UI surfaces instead of brittle CSS or text-only selectors
- Cover one user-visible flow per test; keep smoke tests small and high-signal
- Use live-backend tests sparingly for real compile/integration verification, and gate them behind the existing opt-in flag

## Philosophy

- No backward compatibility. This repo has no existing users — always move forward. Use the latest tools, break things freely, never add shims or deprecation paths.
- When developing new features that are related to compiler, please see.

## Brand & Colors

All colors are semantic tokens defined in `frontend/src/index.css` `@theme`. Use these tokens — never hardcode hex values in components (except CodeMirror editor highlights).

| Token | Usage |
|-------|-------|
| `brand` / `brand-hover` / `brand-light` | CTAs, active tabs, selected states |
| `surface-0` / `surface-1` / `surface-2` | Backgrounds: content → toolbar → hover |
| `ink` / `ink-muted` / `ink-faint` / `ink-inverse` | Text: primary → secondary → disabled → on-brand |
| `border` / `border-strong` | Dividers → focused/active borders |
| `status-error` / `status-warning` / `status-success` | Functional status indicators |

Source: [uOttawa brand guidelines](https://www.uottawa.ca/about-us/administration-services/brand)

**Important**: When previewing the app in a browser (including Chrome MCP), always use `https://umple-next.elwin.cc` (no port). Cloudflare Tunnel handles TLS and proxies to localhost:3100.

## CI/CD

CI runs on every push/PR via GitHub Actions (`.github/workflows/ci.yml`): TypeScript check, frontend build, E2E tests, Go vet/build, Docker image builds.

CD (`.github/workflows/deploy.yml`) triggers after CI succeeds on `master`: SSHs into the server, pulls pre-built images from GitHub Container Registry, and restarts services. No source code needed on the server. The `production` environment requires reviewer approval before deploy runs — this lets maintainers batch multiple merged PRs before shipping.

Rollback (`.github/workflows/rollback.yml`) is a manual workflow: Actions → Rollback → enter an image tag (e.g. `sha-abc1234`) to redeploy a previous version.

Images are pushed to `ghcr.io/elwinliu/umple-next/{backend,frontend,code-exec}`.

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | Server hostname/IP |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key |
| `DEPLOY_SSH_PORT` | SSH port (default 22) |
| `DEPLOY_PATH` | Path to deploy directory (CD creates it + syncs compose file) |

### Server setup (one-time)

CD automatically copies `docker-compose.prod.yml` from the repo and creates a default `.env` if missing. The only manual step is creating the deploy directory and configuring the `.env` for production:

```bash
mkdir -p ~/deploy/umple-next
echo "ALLOWED_ORIGINS=https://your-domain.example.com" > ~/deploy/umple-next/.env
```

### GitHub environment setup

Create a `production` environment in repo Settings → Environments:
- **Required reviewers**: add maintainers who can approve deploys
- **Deployment branches**: restrict to `master`

### Migrating to prof's server

1. Install Docker on the new server
2. Create the deploy directory and `.env` (see above)
3. Configure a reverse proxy (nginx or Cloudflare Tunnel) to forward the domain to `localhost:3100`
4. Update the 5 GitHub secrets to point to the new server
5. Configure the `production` environment with required reviewers (see above)
6. Push to master — CD deploys after reviewer approval