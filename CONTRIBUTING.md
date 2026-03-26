# Contributing

## Getting Started

See `AGENTS.md` for the full tech stack, dev workflow, and available commands.

## Running Tests

### Unit tests (Vitest)

```bash
cd frontend && bun run vitest run
```

### E2E tests (Playwright)

```bash
make test-e2e          # Mocked frontend smoke tests
make test-e2e-live     # Against the live backend stack (requires `make dev`)
```

### Full local CI check

```bash
make check             # Frontend typecheck/build/e2e + backend download/vet/build
```

### AI agent live tests

The AI agent test suite (`frontend/src/ai/__tests__/agent-loop.test.ts`) calls a real LLM API. These tests are **skipped by default** and require a personal API key to run.

To enable them:

1. Copy the example env file:
   ```bash
   cp frontend/.env.test.example frontend/.env.test
   ```
2. Fill in your API key in `frontend/.env.test`:
   ```
   AI_PROVIDER=openrouter
   AI_MODEL=minimax/minimax-m2.7
   AI_API_KEY=your-api-key-here
   ```
3. Run with the live flag:
   ```bash
   cd frontend && AI_LIVE_TESTS=1 bun run vitest run src/ai/__tests__/agent-loop.test.ts
   ```

> **Do not commit `.env.test`** — it is gitignored. Only `.env.test.example` is tracked.
