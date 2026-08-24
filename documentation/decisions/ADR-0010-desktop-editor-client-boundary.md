# ADR-0010: Establish the Electron desktop editor client boundary

**Status**: Accepted  
**Date**: 2026-08-24

## Context

NarrativeX's current `app/frontend-web` client is organized as a browser studio. The target workflow is a dense editor workspace with a persistent activity bar, project explorer, preview canvas, inspector, render queue and multi-track timeline. This interaction model is better served by a desktop client and must not be coupled to the web route/page shell.

The desktop client also needs a safe boundary for future local execution, cache access and FFmpeg orchestration. The renderer must not receive direct Node.js access, and the backend remains authoritative for durable domain state.

## Decision

Create `app/desktop` as a sibling client to `app/frontend-web`, built with Electron, Electron Vite, React and TypeScript.

- `src/main` owns the desktop window and future local execution coordination.
- `src/preload` exposes a narrow, allowlisted bridge with `contextIsolation: true`, `nodeIntegration: false` and sandboxing enabled.
- `src/renderer` owns the editor workspace and consumes typed, read-only backend contracts for the initial migration surface. It renders explicit loading, empty and error states and must not select mock data at runtime.
- The editor timeline models visual clips with `startMs` / `endMs`; duration is derived and narration remains the master clock.
- The renderer does not become a second source of truth and does not implement final rendering. API adapters consume backend contracts with session credentials; state-changing calls use the existing CSRF flow and idempotency keys, while final rendering will use the desktop FFmpeg execution engine.
- `app/frontend-web` remains intact while the desktop client is migrated feature-by-feature.

## Consequences

### Positive

- The desktop editor can evolve without fighting the web dashboard's navigation and layout assumptions.
- Electron security boundaries are established before local device and render protocols are added.
- The UI can be developed independently while preserving a visible contract boundary for loading, empty and backend-error states.
- Migration is incremental: web workflows remain available while desktop production editing is developed.

### Negative

- The repository temporarily maintains two frontend clients and two dependency graphs.
- Desktop packaging, auto-update, local cache and IPC lifecycle still need production hardening.
- UI behavior must be kept aligned with backend domain contracts during migration.

## Implementation notes

Phase UI-1 is implemented in `app/desktop/src/renderer/features/editor/EditorScreen.tsx`, `styles.css` and `api/`. The renderer entrypoint is intentionally thin: `app/DesktopApp.tsx` composes `providers.tsx` and `DesktopRouter.tsx`, while the editor feature owns workspace state and presentation. Hash routes are declared for the migration target screens without coupling the renderer to Electron or Next.js navigation. The shell reads project, production-timeline, asset, character, voice and preset contracts without duplicating backend identity or policy logic. Export submits the production render contract with CSRF and idempotency protection, then polls the backend generation job; the queue stays idle when no job exists. The next phase should move shared client contracts out of feature-local API types, then add editor mutations, cancellation/recovery actions and local FFmpeg handoff.

## Related decisions

- [ADR-0001: System topology, modular monolith, durable execution and persistence architecture](./ADR-0001-system-topology-execution-and-persistence.md)
- [ADR-0003: Media storage, generation pipelines and external provider integrations](./ADR-0003-media-storage-generation-pipelines-and-external-integrations.md)
