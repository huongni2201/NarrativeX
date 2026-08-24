# NarrativeX Desktop App Migration

## Goal

Make `app/desktop` the primary NarrativeX client while keeping Spring Boot + PostgreSQL authoritative for durable business metadata, ownership, policy and job state.

Desktop owns the editor workspace, project media bytes, local filesystem/cache, native capabilities and local FFmpeg execution. The renderer never receives unrestricted Node.js access.

## Migration rules

- Google OIDC is the only end-user login flow; password login/register/forgot-password must not be reintroduced.
- Desktop authentication uses the system browser + `narrativex://auth/callback` one-time handoff into a server-managed NarrativeX session.
- Local-execution device tokens are separate machine credentials; they are not user OAuth/session tokens.
- Spring backend remains the control plane and durable source of truth for metadata, ownership, policy, job admission, assignment and lease state.
- Desktop project media is local-first: generated/imported images, project audio, imported media, render intermediates and final MP4 files stay on the user's machine.
- Backend contracts identify local media by stable asset IDs/checksums; absolute filesystem paths are never persisted or sent as durable backend state.
- R2 is not the Desktop project-media store. It may remain for deliberately shared voice/sample media and for the retained cloud/legacy execution path.
- `LOCAL_DEVICE` render execution is assigned by the backend and claimed only by an authorized device credential.
- Electron `main` owns system-browser/deep-link handling, device identity, protected storage, local project manifests, heartbeat, native filesystem actions and local execution.
- Electron `preload` exposes a narrow typed capability bridge.
- Electron `renderer` owns UI/routing/query/editor state only.
- FFmpeg/ffprobe execution runs outside the renderer.
- Cloud project render remains a temporary migration fallback and does not redefine the Desktop local-storage boundary.
- `app/frontend-web` is a temporary legacy migration client and may be removed only after Desktop parity gates pass.

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

### Still partial / next work

- crash/restart recovery for an in-flight local render;
- resumable/recoverable local render state across Desktop process restarts;
- automatic local-device registration after user authentication if pairing is to be removed from the primary UX;
- complete migration of every image/TTS/import output into the local project manifest without depending on cloud materialization;
- editor mutations, timeline editing depth, regeneration/reuse workflows and remaining screen parity;
- disk quota/cleanup, project backup/move/restore and missing-file repair UX;
- packaging, code signing, auto-update and protocol-registration hardening across supported OSes;
- final removal of `app/frontend-web` and cloud-only UI assumptions after parity evidence exists.

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

### Slice 6 — Generation/import local materialization — IN PROGRESS

- image generation result → local project asset;
- TTS/narration result → local project asset;
- imported media/audio → local project asset;
- backend records identity/checksum, not absolute local path.

### Slice 7 — Desktop editor parity — IN PROGRESS

- project/chapter/editor/timeline/characters/images/TTS/assets/render/settings;
- mutations, review/regeneration, queue/error/recovery UX;
- remove browser/page-shell assumptions.

### Slice 8 — Reliability and packaging — TARGET

- restart-safe execution recovery;
- disk cleanup/backup/move/repair;
- packaging/signing/auto-update;
- protocol and OS integration tests.

### Slice 9 — Legacy web removal — TARGET

Remove `app/frontend-web` only when all required product flows are proven on Desktop and no runtime/deployment/doc/test dependency still requires it.

## Completion gate

Desktop migration is complete when:

- Desktop is the only primary editor surface.
- Password authentication is absent from production product flows.
- Desktop user auth is Google-only and does not expose Google tokens to Electron.
- Required project media generation/import paths register bytes into the local project manifest.
- Local renders use asset IDs/checksums, not cloud object keys or absolute paths.
- Electron main owns checksum-verified local render execution and handles lease loss safely.
- Final local completion records `LOCAL_DESKTOP` plus an opaque project-relative artifact key.
- In-flight local work has defined crash/restart recovery behavior.
- Packaging/protocol/upgrade paths are production-tested.
- Legacy web routes, Next.js-only product assumptions and obsolete cloud-first Desktop docs are removed.

## Related decisions

- `ADR-0010-desktop-editor-client-boundary.md`
- `ADR-0011-google-oauth-only-desktop-auth.md`
- `ADR-0012-desktop-local-first-media-and-render-execution.md`
