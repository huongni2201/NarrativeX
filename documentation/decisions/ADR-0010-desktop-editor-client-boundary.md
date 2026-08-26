# ADR-0010: Establish the Electron desktop editor client boundary

**Status:** Accepted  
**Date:** 2026-08-24  
**Updated:** 2026-08-26 after legacy web removal, OAuth fallback cleanup and Desktop sandbox compatibility adjustment

## Context

NarrativeX's creator experience is a dense desktop editor with a persistent activity bar, project explorer, preview, inspector, render queue and multi-track timeline. The former browser editor was removed after the Desktop migration gates completed.

The Desktop client also owns native capabilities that should not exist in a browser renderer: local project storage, system file/folder selection, protected device credentials, deep-link handling and FFmpeg/ffprobe execution.

The backend remains authoritative for durable domain state, ownership, policy and execution admission. The Desktop renderer must not become a second backend or receive unrestricted Node.js access.

## Decision

`app/desktop` is the only supported NarrativeX editor client, built with Electron, Electron Vite, React and TypeScript.

The former `app/frontend-web` client was removed from the repository and active runtime topology. Spring browser routes that remain for Google OAuth are backend authentication flow only, not a second editor client.

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
sandbox          = false
```

The Chromium renderer sandbox is disabled because it cannot initialize reliably in the current
Desktop runtime environments. This is a deliberate security trade-off, not permission for the
renderer to access native APIs directly: `nodeIntegration` remains disabled, context isolation
remains enabled, and preload exposes only narrow, trust-checked IPC capabilities. Re-enable the
renderer sandbox when the affected Electron environments are supported and verified.

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

Process-restart render recovery/resume and several planned editor/review hardening items remain incomplete. Do not describe them as implemented, and do not treat the removed browser editor as a current dependency.

## Consequences

### Positive

- Desktop UI can evolve around editor ergonomics rather than browser-page constraints.
- Native storage/render features have an explicit security boundary.
- Local long-form media/render flows avoid unnecessary cloud transfer.
- The backend remains one durable business/control authority.
- Remaining Desktop roadmap work can proceed without a parallel browser editor.

### Negative

- Two client dependency graphs exist temporarily.
- Desktop packaging, auto-update, disk cleanup, backup/device migration and crash recovery need production hardening.
- Feature completeness remains tracked independently from the completed browser-client removal.

## Invariants

1. New editor features target `app/desktop`; do not recreate `app/frontend-web` without an explicit architecture decision.
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
