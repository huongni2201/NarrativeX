# ADR-0004: Desktop is the only editor client, split into main / preload / renderer

- **Status:** Accepted
- **Date:** 2026-10-15 (consolidated)
- **Replaces:** former ADR-0006 (client part) and the older capability-IPC and renderer UI stack decisions (Git history)

## Context

The creator workflow is a dense desktop editor (activity bar, project explorer, preview, inspector, render queue, multi-track timeline). It needs native capabilities that a browser renderer must not have: local project storage, file and folder pickers, protected credentials, child processes (FFmpeg, `agy`) and deep links. The former browser editor (`app/frontend-web`) has been removed.

## Decision

1. `app/desktop` (Electron, Electron Vite, React, TypeScript) is the only supported editor client.
2. **Electron main** owns privileged work: window lifecycle and security configuration, local workspace and manifest access, native pickers and reveal/open actions, protected device identity and heartbeat, the backend transport, the agy CLI runner (ADR-0009), FFmpeg/ffprobe discovery and execution, and the local render lifecycle (ADR-0005).
3. **Preload** exposes a narrow, allow-listed, typed bridge. It never exposes `fs`, `child_process`, shell or Node globals.
4. **Renderer** owns UI, routing, React Query cache and editor draft state. It calls backend endpoints using Desktop-owned request/response types and explicit preload capabilities, and never owns native paths, credentials, durable business policy or render mechanics.
5. Window security baseline: `contextIsolation = true`, `nodeIntegration = false`, `sandbox = false`. The Chromium renderer sandbox is disabled only because it cannot start reliably in current target environments. This is a temporary trade-off and grants no extra renderer access. Re-enable it once those environments are verified.
6. The renderer UI uses Tailwind CSS 4, source-owned accessible Radix primitives, CVA variants and semantic design tokens. Component source stays in the renderer.
7. Desktop-owned request and response types live in `app/desktop/src/shared/api-types`. They describe the JSON Desktop sends and receives; backend DTOs remain independently owned by the backend.

## Invariants

1. New editor features target `app/desktop`. Recreating a browser editor requires a new ADR.
2. Renderer code never gains unrestricted Node.js, filesystem or process access.
3. Native capabilities cross preload as narrow typed actions with sender and window trust checks.
4. The backend stays authoritative for policy, admission and durable state. Desktop is never a second backend.

## Consequences

- The UI can be designed around editor ergonomics instead of browser-page constraints.
- Packaging, signing, auto-update, crash recovery and data migration between machines need release hardening (see the [roadmap](../product/roadmap.md)).

## Related

- [ADR-0001](ADR-0001-single-user-local-first.md) · [ADR-0005](ADR-0005-local-media-and-final-render.md) · [ADR-0009](ADR-0009-chapter-analysis-agy-cli.md)
