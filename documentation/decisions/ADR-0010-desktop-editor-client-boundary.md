# ADR-0010: Establish the Electron desktop editor client boundary

**Status:** Accepted  
**Date:** 2026-08-24  
**Updated:** 2026-08-24 after the first local-execution/render implementation slice

## Context

NarrativeX is migrating its primary creator experience from a browser studio to a dense desktop editor with a persistent activity bar, project explorer, preview, inspector, render queue and multi-track timeline.

The Desktop client also owns native capabilities that should not exist in a browser renderer: local project storage, system file/folder selection, protected device credentials, deep-link handling and FFmpeg/ffprobe execution.

The backend remains authoritative for durable domain state, ownership, policy and execution admission. The Desktop renderer must not become a second backend or receive unrestricted Node.js access.

## Decision

`app/desktop` is the primary NarrativeX editor client, built with Electron, Electron Vite, React and TypeScript.

`app/frontend-web` remains only as a temporary legacy migration client until Desktop parity/removal gates are satisfied.

### Electron main

Electron main owns native/runtime capabilities:

- BrowserWindow lifecycle and security configuration;
- system-browser Google OAuth start and `narrativex://` custom-protocol callback handling;
- local project workspace/manifest access;
- native file/folder selection and artifact reveal/open actions;
- protected device identity and local-execution heartbeat;
- backend-assigned local render claim/progress/completion/failure lifecycle;
- FFmpeg/ffprobe discovery and execution;
- cancellation of active local render processes.

### Preload

`src/preload` exposes a narrow allow-listed typed bridge. It must not expose arbitrary `fs`, `child_process`, shell or Node globals.

### Renderer

`src/renderer` owns UI/routing/query/editor state. It may call backend application contracts and invoke explicit preload capabilities, but it does not own native paths, durable business policy or final rendering mechanics.

The window security baseline is:

```text
contextIsolation = true
nodeIntegration  = false
sandbox          = true
```

### Timeline and rendering

Timeline clips use explicit `startMs`/`endMs`; narration timing remains the master clock.

For `LOCAL_DEVICE` project rendering, Electron main executes FFmpeg outside the renderer according to ADR-0012. Cloud/server render remains a migration fallback.

### Local project media

Desktop project media is local-first. Electron main maps stable backend asset IDs to checksum-verified project-relative files through `project.manifest.json`. Absolute local paths are never persisted as backend asset identities.

## Current implementation checkpoint

At `main` commit `751f006634218efb2c398fc00c2cbfecd25e1eac`:

- the Desktop editor shell and project-scoped routes exist;
- shared client contracts are consumed by the Desktop renderer;
- Google OAuth opens in the system browser and custom-protocol handoff is wired in Electron main;
- `ProjectStorage` owns schema-versioned local manifests and checksum/path-boundary validation;
- local device pairing/identity/heartbeat is wired;
- backend-assigned local project renders can be claimed by the device;
- lease heartbeat, progress, completion, failure and in-process cancellation are wired;
- FFmpeg/ffprobe probing and a full local project-render foundation exist: segment render, video concat, narration concat, mux, validation and local artifact registration.

Process-restart render recovery/resume and complete feature parity with the legacy web client remain incomplete. Do not describe them as implemented.

## Consequences

### Positive

- Desktop UI can evolve around editor ergonomics rather than browser-page constraints.
- Native storage/render features have an explicit security boundary.
- Local long-form media/render flows avoid unnecessary cloud transfer.
- The backend remains one durable business/control authority.
- Migration can remain incremental while the legacy web client still exists.

### Negative

- Two client dependency graphs exist temporarily.
- Desktop packaging, auto-update, disk cleanup, backup/device migration and crash recovery need production hardening.
- Feature parity must be tracked before `app/frontend-web` is deleted.

## Invariants

1. New primary editor features target `app/desktop`, not `app/frontend-web`.
2. Renderer code never gains unrestricted Node.js/filesystem/process access.
3. Native capabilities cross preload as narrow typed actions.
4. Backend remains authoritative for ownership, policy, job admission and durable execution state.
5. Local project bytes follow ADR-0012.
6. Google user authentication follows ADR-0011.
7. Cloud render/storage remains a compatibility path, not the Desktop architecture default.

## Related decisions

- [ADR-0001: System topology, durable execution and persistence](./ADR-0001-system-topology-execution-and-persistence.md)
- [ADR-0003: Cloud media storage and provider integrations](./ADR-0003-media-storage-generation-pipelines-and-external-integrations.md)
- [ADR-0011: Google OAuth-only desktop authentication](./ADR-0011-google-oauth-only-desktop-auth.md)
- [ADR-0012: Desktop local-first media and render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)
