# NarrativeX Desktop App Migration

## Goal

Make `app/desktop` the primary NarrativeX client while keeping Spring Boot + PostgreSQL authoritative for durable business metadata, ownership and job state. Desktop owns the editor workspace, project media bytes, local filesystem/cache, local execution coordination and FFmpeg handoff. The renderer never receives unrestricted Node.js access.

## Migration rules

- Google OIDC is the only end-user login flow; password login/register must not be reintroduced.
- Spring backend remains the control plane and durable source of truth for metadata, policy, ownership and execution state.
- Desktop project media is local-first: generated images, project audio, imported media, render intermediates and final MP4 files stay on the user's machine.
- Backend contracts identify local media by stable asset IDs/checksums; absolute filesystem paths are never persisted or sent to the backend.
- R2 is not a Desktop project-media store. For the Desktop flow it is reserved for shared voice/sample audio that must be reusable across installations.
- `LOCAL_DEVICE` project render execution is assigned by the backend and claimed only by the assigned device token.
- Electron `main` owns device identity, safe storage, local project manifests, heartbeat and local job execution.
- Electron `preload` exposes a narrow typed capability bridge.
- Electron `renderer` owns UI state only and consumes backend contracts.
- FFmpeg execution must run outside the renderer.
- Cloud project render remains a temporary fallback during migration and does not redefine the Desktop local-storage boundary.

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

`project.manifest.json` maps backend asset IDs to project-relative paths plus size/checksum metadata. Electron main resolves these IDs and rejects path traversal or checksum mismatches before a local render starts.

## Implementation slices

1. Sync the desktop shell from `main` into this branch and preserve the existing local-render backend work.
2. Remove stale password-auth code from the branch and keep Google OIDC + session/CSRF behavior.
3. Fold local-device identity/heartbeat capabilities into `app/desktop`.
4. Add local project-render claim/progress/result client in Electron main.
5. Add local project storage + manifest resolution in Electron main; do not download render inputs from R2.
6. Expose only typed local-execution/storage status actions through preload.
7. Wire renderer export to choose `LOCAL_DEVICE` when a capable device and required local assets are ready.
8. Add FFmpeg/runtime supervisor and immutable render-manifest execution.
9. Migrate image/TTS/import workflows so Desktop results register directly into the local project manifest; only shared voice/sample audio remains remote on R2.
10. Migrate remaining web feature surfaces and remove `app/frontend-web` only after parity gates pass.

## Current implementation checkpoint (2026-08-24)

- Desktop Google authentication now uses the system browser, a `narrativex://auth/callback` handoff,
  a 90-second single-use code and a server-managed `NX_SESSION` created by the desktop exchange API.
- Desktop routes are project-scoped under `#/projects/:projectId/*`; active project selection is held
  in renderer Zustand while project data remains in React Query.
- Local FFmpeg capability probing, ffprobe metadata parsing, progress parsing and deterministic
  local render-manifest fingerprinting are available in Electron main. Full render orchestration,
  lease-aware cancellation and crash recovery remain the next P1 implementation slice.

## Completion gate for this branch

- Branch contains the current desktop shell foundation without reverting newer `main` renderer work.
- Branch no longer exposes password login/register.
- Desktop main can pair/heartbeat as a local device and claim an assigned project render.
- Local render claim contracts use `mediaAssetId` / `narrationAssetId`, not remote storage keys.
- Electron main owns a checksum-verified project manifest and resolves local asset IDs without exposing arbitrary filesystem APIs to the renderer.
- Local render completion records `LOCAL_DESKTOP` plus an opaque project-relative artifact key; no absolute path is persisted in backend state.
- Existing cloud render path remains compatible as a migration fallback.
- Backend lease lifecycle tests cover local claim/progress/completion behavior.
