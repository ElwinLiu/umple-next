# LSP Proxy

The LSP proxy bridges browser WebSocket messages from CodeMirror to
`umple-lsp-server`, which speaks the Language Server Protocol over stdio.

Browsers cannot spawn or talk to stdio language servers directly, so this
service owns the transport boundary and process lifecycle.

## Runtime Shape

```
CodeMirror LSP client
  |
  | WebSocket JSON-RPC at /ws/lsp?session={modelId}
  v
lsp-proxy
  |
  | Content-Length framed JSON-RPC over stdio
  v
umple-lsp-server --stdio
```

In development, Vite rewrites `/ws/lsp` to the proxy's root WebSocket endpoint.
In production, frontend nginx does the same rewrite before proxying to the
`lsp-proxy` container.

## Internal Architecture

`server.js` is intentionally small and direct:

- Creates an HTTP server for `/health` and `/status`.
- Creates a WebSocket server on the same port.
- Validates `session` query parameters with `SESSION_ID_RE`.
- Resolves the model directory under `UMP_BASE_DIR` and rejects missing or
  path-traversal attempts.
- Enforces a global process cap with `LSP_MAX_PROCESSES`.
- Spawns `LSP_COMMAND --stdio` for each accepted WebSocket connection.
- Sets `UMPLE_SESSION_DIR` for the child process so the LSP server can read the
  model workspace.
- Optionally passes `UMPLESYNC_JAR_PATH` through to the LSP process.
- Converts WebSocket JSON messages into LSP stdio frames.
- Parses LSP stdout frames and sends JSON messages back to the browser.
- Kills the child process when the socket closes or the process exits.

The status endpoint reports process counts, rejected connections, configured
command, base directory, process limit, debug mode, PID, port, and uptime.

## Frontend Contract

The frontend LSP client lives in:

- `frontend/src/hooks/useLsp.ts`
- `frontend/src/codemirror/lsp.ts`

The browser sends `session={modelId}`. The proxy requires the corresponding
directory to exist under `UMP_BASE_DIR`, which is the same mounted model store
used by the backend. The frontend keeps all tab files synchronized so the LSP
server can provide cross-file diagnostics, definitions, references, and rename
behavior.

## How This Differs From The Original

Legacy UmpleOnline also had a WebSocket-to-stdio LSP proxy under
`~/umple/umpleonline/scripts/lsp-proxy/`, configured from the PHP-rendered
page. In that stack, `umple.php` emitted globals such as
`window.UMPLE_LSP_WS_URL`, `window.UMPLE_LSP_TOKEN`, and `window.UMPLE_UMP_BASE`.
The legacy proxy validated HMAC tokens from PHP and was run under the legacy
nginx/PHP/supervisord container setup.

This rewrite keeps the same core transport idea but moves it into the modern
service architecture:

- The proxy is a top-level Docker Compose service instead of a script inside
  the PHP application tree.
- The browser reaches it through `/ws/lsp`, the same-origin route owned by the
  frontend dev/prod proxy layer.
- The current contract validates the model directory and session ID, but does
  not depend on PHP-generated LSP tokens.
- Runtime observability is exposed through `/health` and `/status` for Compose
  and the backend status page.
- Model files live under the shared `/data/models` mount used by the Go
  backend, not the legacy `/var/www/ump` tree.

## Development

From this folder:

```bash
npm install
npm start
```

Normally this service is run by Docker Compose because the image installs
`umple-lsp-server` and mounts the model store:

```bash
make dev-backend
```

Useful environment variables:

- `LSP_PORT` - WebSocket/HTTP port, default `9999`.
- `UMP_BASE_DIR` - model directory root, default `/data/models`.
- `LSP_COMMAND` - language server command, default `umple-lsp-server`.
- `UMPLESYNC_JAR_PATH` - optional path passed through to the LSP server.
- `LSP_MAX_PROCESSES` - global child-process limit, default `20`.
- `LSP_DEBUG=1` - logs LSP method names as messages flow through the proxy.
