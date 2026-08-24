# NarrativeX Desktop App Migration

## Goal

Make `app/desktop` the primary NarrativeX client while keeping Spring Boot + PostgreSQL authoritative for durable business state. Desktop owns the editor workspace, local filesystem/cache, local execution coordination and FFmpeg handoff. The renderer never receives unrestricted Node.js access.

## Migration rules

- Google OIDC is the only end-user login flow; password login/register must not be reintroduced.
- Spring backend remains the control plane and durable source of truth.
- `LOCAL_DEVICE` project render execution is assigned by the backend and claimed only by the assigned device token.
- Electron `main` owns device identity, safe storage, heartbeat and local job execution.
- Electron `preload` exposes a narrow typed capability bridge.
- Electron `renderer` owns UI state only and consumes backend contracts.
- FFmpeg execution must run outside the renderer.
- Cloud project render remains a fallback during migration.

## Implementation slices

1. Sync the desktop shell from `main` into this branch and preserve the existing local-render backend work.
2. Remove stale password-auth code from the branch and keep Google OIDC + session/CSRF behavior.
3. Fold local-device identity/heartbeat capabilities into `app/desktop`.
4. Add local project-render claim/progress/result client in Electron main.
5. Expose only typed local-execution status/actions through preload.
6. Wire renderer export to choose `LOCAL_DEVICE` when a capable device is online, with explicit cloud fallback.
7. Add local cache + FFmpeg/runtime supervisor and immutable render-manifest execution.
8. Migrate remaining web feature surfaces and remove `app/frontend-web` only after parity gates pass.

## Completion gate for this branch

- Branch contains the current desktop shell.
- Branch no longer exposes password login/register.
- Desktop main can pair/heartbeat as a local device and claim an assigned project render.
- Renderer can observe local execution status without direct Node.js access.
- Existing cloud render path remains compatible.
- Backend/MyBatis migration tests and desktop type/build checks are green where CI is available.
