<p align="center">
  <img src=".github/umple_logo.svg" alt="Umple" height="80">
</p>

# UmpleOnline

A modern rewrite of [UmpleOnline](https://try.umple.org) — the browser-based tool for editing [Umple](https://umple.org) models textually and graphically, generating code, and visualizing class diagrams and state machines.

This project reproduces the legacy PHP/jQuery stack with a contemporary architecture while preserving the same Umple compiler and modeling capabilities.

**Live instance:** [umple-next.elwin.cc](https://umple-next.elwin.cc/)

## Architecture

```
┌─────────────────────────────┐
│     Frontend (React/TS)     │  Port 3200 (dev) / 3100 (prod)
│  CodeMirror · ReactFlow     │
│  Tailwind CSS · Zustand     │
└────────────┬────────────────┘
             │ /api/*
┌────────────▼────────────────┐
│       Backend (Go/Chi)      │  Port 3001
│  ├─ TCP ──▶ umplesync.jar   │
│  └─ pipe ─▶ Graphviz (dot)  │
└────────────┬────────────────┘
             │
┌────────────▼────────────────┐
│   Code Exec (Node.js)       │  Port 4400
│   Sandboxed code runner     │
└─────────────────────────────┘
```

Three services, all containerized with Docker:

- **Frontend** — React 19, TypeScript, Vite, CodeMirror 6, ReactFlow
- **Backend** — Go 1.24 (Chi router), communicates with `umplesync.jar` via TCP and Graphviz for diagram rendering
- **Code Exec** — Node.js service for running compiled code in a sandbox

## Getting Started

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, available commands, and contribution guidelines.

## License

[MIT](LICENSE.md) — see the license file for the full list of contributors.

## Links

- **Umple project:** [umple.org](https://umple.org)
- **Original UmpleOnline:** [try.umple.org](https://try.umple.org)
- **Umple user manual:** [manual.umple.org](https://manual.umple.org)
- **Umple source:** [github.com/umple/umple](https://github.com/umple/umple)
