# NarrativeX Desktop App Migration

## Goal

Use `app/desktop` as the only NarrativeX editor client while keeping Spring Boot + PostgreSQL authoritative for durable business metadata, ownership, policy and job state.

Desktop owns the editor workspace, project media bytes, local filesystem/cache, native capabilities and local FFmpeg execution. The renderer never receives unrestricted Node.js access.

## Migration rules

- Google OIDC is the only end-user login flow; password login/register/forgot-password must not be reintroduced.
- Desktop authentication uses the system browser + `narrativex://auth/callback` one-time handoff into a server-managed NarrativeX session.
- Local-execution device tokens are separate machine credentials; they are not user OAuth/session tokens.
- Spring backend remains the control plane and durable source of truth for metadata, ownership, policy, job admission, assignment and lease state.
- Desktop project media is local-first: generated/imported images, project audio, imported media, render intermediates and final MP4 files stay on the user's machine.
- Backend contracts identify local media by stable asset IDs/checksums; absolute filesystem paths are never persisted or sent as durable backend state.
- R2 is not the Desktop project-media store. It may remain for deliberately shared voice/sample media and for retained server-worker execution paths.
- `LOCAL_DEVICE` render execution is assigned by the backend and claimed only by an authorized device credential.
- Electron `main` owns system-browser/deep-link handling, device identity, protected storage, local project manifests, heartbeat, native filesystem actions and local execution.
- Electron `preload` exposes a narrow typed capability bridge.
- Electron `renderer` owns UI/routing/query/editor state only.
- FFmpeg/ffprobe execution runs outside the renderer.
- Cloud project render remains a temporary migration fallback and does not redefine the Desktop local-storage boundary.
- `app/frontend-web` has been removed. Do not recreate a parallel browser editor without an explicit architecture decision.

## Local workspace layout

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/
    images/
    audio/
    video/
  artifacts/
    <jobId>/final.mp4
  work/
```

`project.manifest.json` maps backend asset IDs to project-relative paths plus size/checksum metadata. Electron main resolves these IDs and rejects path traversal, missing files, size mismatches and checksum mismatches before local execution.

## Current implementation checkpoint

**Checkpoint:** `main` at `751f006634218efb2c398fc00c2cbfecd25e1eac` on 2026-08-24.

### Implemented foundation

- Electron + Electron Vite + React + TypeScript Desktop shell is present and project-scoped.
- Desktop BrowserWindow uses `contextIsolation: true`, `nodeIntegration: false` and sandboxing.
- Google login starts through `/api/v1/auth/desktop/start` in the system browser.
- `narrativex://auth/callback` custom-protocol handling is wired for first/second application instance flows.
- Backend one-time handoff exchange establishes the server-managed NarrativeX security context.
- `ProjectStorage` creates the local workspace/manifest and atomically records checksum-verified assets/artifacts.
- Local project path resolution is workspace-bound and rejects traversal.
- Local execution has explicit pairing/device identity, heartbeat and ONLINE/OFFLINE status.
- Backend-assigned local project renders can be claimed by the device.
- Claimed narration/image inputs are resolved by asset ID + expected size/checksum.
- Render lease heartbeat, progress reporting, completion, failure handling and in-process cancellation are wired.
- FFmpeg/ffprobe capability detection exists.
- `ProjectRenderer` executes segment render → video concat → narration concat → mux → ffprobe → local artifact registration.
- Local project rendering is gated by FFmpeg availability and `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true`.
- The legacy `app/frontend-web` client and Caddy layer have been removed from the active runtime/repository topology.

### Still partial / next work

- backend attachment/alignment endpoint for the `USER_PROVIDED_AUDIO` narration-set flow (Desktop deliberately disables TTS when that mode is selected until this endpoint is available);
- automatic local-device registration after user authentication if pairing is to be removed from the primary UX;
- project backup/move/restore and packaged Electron E2E;
- packaging, code signing, auto-update and protocol-registration hardening across supported OSes;
- remaining stale browser-only assumptions in historical/derived documentation should be cleaned as those documents are touched.

### 2026-08-25 implementation checkpoint

- Desktop project creation and favorite mutations now use React Query and backend APIs; the empty-project UX no longer directs users to the web app.
- Chapter list/create/update/delete is available from the Desktop Chapter Workspace with `If-Match` row-version handling.
- Renderer API boundaries are split into projects, chapters, assets, catalog, generation, narration and production modules. `workspace.ts` remains only a compatibility facade for the existing editor shell.
- Native asset import now uses a two-phase Electron flow: main-process inspection/hash produces a short-lived selection token, the backend registers a `LOCAL_ONLY` media identity, and main commits the selected file into `ProjectStorage` without exposing an absolute path to the renderer.
- Production export now sends Desktop timeline beat overrides and the editor has duration/camera draft state with undo/redo/reset.
- `media_assets.storage_mode` and `local_media_materializations` are part of the clean V1 baseline. Existing production/remote assets remain `REMOTE`; local registrations never persist a filesystem path.
- Image generation now supports chapter selection, analysis, estimate, queue, polling, review, and verified remote-to-local materialization. Narration supports single/batch TTS, voice preview, and local audio import with an explicit `USER_PROVIDED_AUDIO` guard that never silently enqueues TTS.
- Export runs a local preflight for FFmpeg/ffprobe, executor state, disk capacity, and local asset checksum/size before submitting a render job.
- Render stages persist an atomic `render.state.json` journal; Desktop scans unfinished journals at local-execution startup and Settings exposes them alongside disk usage, project verification, and cleanup of completed/failed work directories. Project manifests migrate from schema v1 to v2.
- Workspace backup/restore/archive-copy is now available from Settings. Backups are manifest-verified directory snapshots; restore preserves the previous active workspace under a `.before-restore-*` name instead of deleting it, and archive-copy leaves the active workspace untouched.
- Settings storage accounting now includes project assets, artifacts, render work, segment cache, and retained backup snapshots; the backup/restore/archive path is covered by manifest and active-workspace preservation tests.
- Render segment output is cached by immutable asset checksum, timeline identity, renderer version, and output settings. Cache hits skip FFmpeg segment rendering while concat/mux still run from the current job workspace.
- AI-worker local I/O retry and UNKNOWN reconciliation delays now use a shared deterministic bounded retry policy. Provider submission remains UNKNOWN-first and must reconcile before resubmission.
- Timeline draft mutations now use a typed command-history state machine with undo/redo semantics, clearing the redo branch after a new edit.
- Added deterministic Node and Python test coverage for timeline drafts, render-journal discovery, workspace backup/restore/archive-copy, storage accounting, retry policy behavior, and UUID/pinned-worker dependency contracts. Browser verification remains blocked by the in-app browser refusing local Vite URLs (`ERR_BLOCKED_BY_CLIENT`) in this environment.
- Legacy `app/frontend-web` was removed; production Compose no longer contains a frontend or Caddy service. Cloudflare Tunnel, when used, routes directly to the backend.

## Implementation slices

### Slice 1 — Desktop shell and shared contracts — IMPLEMENTED foundation

- Electron renderer shell, project-scoped routing, React Query/Zustand state.
- Secure preload boundary and shared client contracts.

### Slice 2 — Google OAuth-only Desktop auth — IMPLEMENTED foundation

- system-browser login;
- custom protocol callback;
- one-time code exchange into server-managed session;
- remove password UX/runtime behavior.

### Slice 3 — Local project storage — IMPLEMENTED foundation

- `<userData>/projects/<projectId>` workspace;
- atomic `project.manifest.json`;
- asset/artifact registration;
- checksum/path-boundary validation.

### Slice 4 — Local device execution — IMPLEMENTED foundation

- protected device identity;
- pairing + heartbeat;
- local render assignment/claim;
- lease heartbeat/progress/completion/failure.

### Slice 5 — Local FFmpeg project render — IMPLEMENTED foundation

- probe FFmpeg/ffprobe;
- immutable local render manifest;
- segment render;
- concat/mux;
- ffprobe/checksum validation;
- local artifact registration;
- cancellation.

### Slice 6 — Generation/import local materialization — IMPLEMENTED foundation

- image generation result → local project asset;
- TTS/narration result → local project asset;
- imported media/audio → local project asset;
- backend records identity/checksum, not absolute local path.

### Slice 7 — Desktop editor parity — IMPLEMENTED foundation

- project/chapter/editor/timeline/characters/images/TTS/assets/render/settings;
- mutations, review/regeneration, queue/error/recovery UX;
- remove browser/page-shell assumptions.

### Slice 8 — Reliability and packaging — IN PROGRESS

- restart-safe execution journal and unfinished-job discovery;
- disk cleanup/verification/repair;
- backup/restore/archive-copy snapshots and safe recovery of the active workspace;
- workspace-root relocation, signing/auto-update and protocol/OS integration tests;
- shared retry policy and segment cache foundation;
- typed timeline command history foundation;
- packaging/signing/auto-update;
- protocol and OS integration tests.

### Slice 9 — Legacy web removal — IMPLEMENTED

- removed `app/frontend-web` from the repository;
- removed the production frontend service;
- removed Caddy from the production ingress path;
- retained Cloudflare Tunnel only as optional direct HTTPS ingress to `backend:8080` for self-hosted deployments.

## Completion gate

Desktop migration is complete when:

- Desktop is the only editor surface.
- Password authentication is absent from production product flows.
- Desktop user auth is Google-only and does not expose Google tokens to Electron.
- Required project media generation/import paths register bytes into the local project manifest.
- Local renders use asset IDs/checksums, not cloud object keys or absolute paths.
- Electron main owns checksum-verified local render execution and handles lease loss safely.
- Final local completion records `LOCAL_DESKTOP` plus an opaque project-relative artifact key.
- In-flight local work has defined crash/restart recovery behavior.
- Packaging/protocol/upgrade paths are production-tested.
- Legacy web routes, Next.js-only product assumptions and obsolete cloud-first Desktop docs are removed from current-state documentation.

## Related decisions

- `ADR-0010-desktop-editor-client-boundary.md`
- `ADR-0011-google-oauth-only-desktop-auth.md`
- `ADR-0012-desktop-local-first-media-and-render-execution.md`
- `ADR-0014-workspace-backup-and-render-segment-cache.md`
