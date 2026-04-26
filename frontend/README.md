# Frontend

The frontend is the browser application for UmpleOnline. It is a React 19,
TypeScript, Vite, Tailwind CSS v4, CodeMirror 6, ReactFlow, and Zustand app.

## Runtime Shape

```
Browser
  |
  | React SPA
  v
CodeMirror editor + diagram/output panels
  |
  | /api/*                 -> Go backend
  | /ws/collab/{roomId}    -> collab service
  | /ws/lsp?session=...    -> lsp-proxy service
  v
backend services
```

In development, Vite serves the app on port `3200` and proxies API/WebSocket
traffic. In production, nginx serves the built SPA on port `80` inside the
frontend container and proxies backend, collaboration, and LSP traffic to the
other containers.

## Internal Architecture

- `src/main.tsx` configures routes and mounts the app.
- `src/App.tsx` provides global UI shell concerns such as theme setup,
  document title, tooltips, and toasts.
- `src/components/layout/AppShell.tsx` composes the main editor workspace:
  sidebar, toolbar, editor panel, output panel, diagram panel, command palette,
  onboarding, and task sheet.
- `src/components/editor` contains CodeMirror editor surfaces, tabs,
  generation/output panels, execution output, and selection tools.
- `src/components/diagram` renders class/state/other diagram output, including
  SVG interaction and diagram toolbar controls.
- `src/api` centralizes calls to the Go backend.
- `src/hooks` contains lifecycle orchestration for compiler calls, URL loading,
  collaboration, LSP, examples, execution, diagram sync, and task routes.
- `src/stores` contains Zustand stores for persisted session data, preferences,
  ephemeral UI state, collaboration state, CRUD state, and task state.
- `src/codemirror` contains the Umple CodeMirror language support and LSP
  client integration.
- `src/generation` centralizes generation target definitions.
- `src/pages/status` provides the developer status page.

## State Model

The frontend intentionally separates user-visible model state from transient UI
state:

- `sessionStore` is the main editor/model store: current code, tabs, active
  model ID, generation target, diagram caches, parsed model data, filters, and
  chat messages.
- `preferencesStore` holds persistent UI preferences such as theme, panel
  choices, diagram options, and sidebar state.
- `ephemeralStore` holds short-lived UI state such as loading/error flags,
  output view state, and active panel choices.
- `collabStore` holds collaboration connection state and room metadata, while
  the actual Yjs objects live outside Zustand.

Compile and diagram generation are orchestrated by `useCompiler`, which reads
the current session snapshot and calls the backend through `src/api/client.ts`.

## Service Integration

- Backend API calls use relative `/api` URLs so dev and prod can share the same
  browser-facing contract.
- Collaboration uses `y-websocket` against `/ws/collab/{roomId}` and stores
  shared tabs in Yjs.
- LSP uses `@codemirror/lsp-client` against `/ws/lsp`, with one
  `umple-lsp-server` process spawned by `lsp-proxy` for the active model.
- Diagram SVG edits can write back to the local session store or the shared
  Yjs tab, depending on whether collaboration is active.

## How This Differs From The Original

Legacy UmpleOnline rendered the main page from
`~/umple/umpleonline/umple.php`, then coordinated the UI through global
JavaScript objects such as `Page`, `Action`, `Layout`, and `TabControl` in
`scripts/umple_page.js`, `scripts/umple_action.js`, and related files. AJAX
calls were made directly to `scripts/compiler.php`.

This frontend changes that shape:

- The UI is a typed React component tree instead of server-rendered PHP plus
  global jQuery handlers.
- State is centralized in Zustand stores instead of page-wide mutable globals.
- API access is centralized in `src/api/client.ts` instead of scattered
  `Ajax.sendRequest("scripts/compiler.php", ...)` calls.
- CodeMirror 6 is integrated as a React editor surface with explicit hooks for
  compile, collaboration, and LSP lifecycles.
- URL/model loading, examples, generation targets, task routes, and status UI
  are separate modules rather than branches inside a monolithic page script.
- Styling uses Tailwind v4 semantic tokens from `src/index.css` instead of
  inline PHP page styles and jQuery UI-era button styling.

## Development

From this folder:

```bash
bun install
bun run dev
bun run build
bun run test
bun run test:e2e
```

From the repo root, the usual entry points are:

```bash
make dev-frontend
make test-e2e
make check
```
