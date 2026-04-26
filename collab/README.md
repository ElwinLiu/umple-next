# Collaboration Service

This service owns realtime multi-user editing for UmpleOnline. It is a small
Node/TypeScript WebSocket server that speaks the Yjs sync and awareness
protocols used by the React frontend.

## Runtime Shape

```
Browser editor
  |
  | y-websocket over /ws/collab/{roomId}
  v
collab service
  |
  | in-memory Y.Doc per room
  v
connected browser peers
```

The frontend connects through the same origin as the app:

- Dev: Vite proxies `/ws/collab/*` to `localhost:${COLLAB_PORT:-3002}`.
- Prod: nginx in the frontend container proxies `/ws/collab/*` to the
  `collab` container.

The service exposes:

- `GET /health` - plain `ok` health check for Docker Compose.
- `GET /status` - JSON runtime stats for active rooms, connections, awareness
  states, process ID, uptime, and connection counters.
- `WS /ws/collab/{roomId}` - Yjs sync and awareness transport.

## Internal Architecture

- `src/server.ts` creates the HTTP server, WebSocket server, health endpoint,
  status endpoint, and room routing.
- `src/sync.ts` contains the Yjs document registry and WebSocket protocol
  handling.
- Each room ID maps to one in-memory `WSSharedDoc`.
- Each `WSSharedDoc` tracks connected sockets plus Yjs awareness client IDs.
- Document updates are rebroadcast with `y-protocols/sync`.
- Presence updates are rebroadcast with `y-protocols/awareness`.
- When the last socket leaves a room, the Yjs document is destroyed and removed
  from memory.

The service does not persist collaboration state. The room is a live shared
editing session. Durable model state is still managed by the backend model
store when the frontend compiles, syncs, promotes, or loads a model.

## Frontend Contract

The React frontend owns the user-facing collaboration lifecycle:

- `frontend/src/hooks/useCollab.ts` creates the `Y.Doc`, connects the
  `WebsocketProvider`, sets awareness identity, and hydrates or seeds shared
  tabs.
- `frontend/src/hooks/useCollabTabs.ts` maps shared Yjs tab state into the
  local Zustand session store.
- `frontend/src/components/editor/UmpleEditor.tsx` binds CodeMirror to the
  active shared `Y.Text`.

Shared Yjs data uses these names:

- `Y.Map("tabs")` stores tab metadata by tab ID.
- `Y.Text("tab:<id>")` stores each tab's source text.

## How This Differs From The Original

Legacy UmpleOnline handled collaboration inside the PHP/jQuery page flow. The
old UI in `~/umple/umpleonline/umple.php` rendered collaboration controls,
loaded `scripts/socket.io/socket.io.js`, and called browser globals from
`scripts/umpleCollab.js`. Its server endpoint was configured through
`scripts/collab-server-config.js.template` with a Socket.IO path such as
`/collabapi`.

This rewrite separates collaboration into a dedicated service:

- The collaboration transport is Yjs binary sync over WebSocket, not the legacy
  Socket.IO collaboration client.
- Room state is isolated in `collab/src/sync.ts` instead of being mixed into
  `Page`, `Action`, and global browser objects.
- The frontend stores collaborative tabs in structured Yjs maps/text objects
  instead of patching a single page-level text model.
- The service has its own health and status endpoints, so orchestration and
  monitoring do not depend on PHP page rendering.

## Development

From this folder:

```bash
bun install
bun run dev
bun run build
```

Normally this service is started by Docker Compose:

```bash
make dev-backend
```

or as part of the full stack:

```bash
make dev
```
