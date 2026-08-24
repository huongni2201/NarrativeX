# NarrativeX Desktop

NarrativeX Desktop is the primary NarrativeX editor client. It is built with Electron, Electron Vite, React and TypeScript and keeps native/local capabilities behind a narrow Electron main/preload boundary.

## Runtime ownership

- `src/renderer` owns UI, routing, editor state, timeline/preview and backend-facing application flows.
- `src/preload` exposes only allow-listed typed capabilities.
- `src/main` owns system-browser OAuth callbacks, local project storage, device identity, local execution coordination, native file/folder dialogs and FFmpeg/ffprobe execution.
- Spring Boot remains authoritative for user/project ownership, durable domain metadata, job admission, render assignment and execution state.
- The renderer runs with `contextIsolation: true`, `nodeIntegration: false` and sandboxing enabled. Do not expose arbitrary filesystem or process APIs to renderer code.

## Authentication

End-user authentication is Google OAuth only.

Desktop starts authentication in the system browser through:

```text
GET /api/v1/auth/desktop/start?redirect_uri=narrativex://auth/callback
```

After Google OIDC completes, the backend redirects a short-lived one-time handoff code to `narrativex://auth/callback`. Electron main receives the custom-protocol URL and forwards only the handoff code to the renderer. The code is exchanged with the backend to establish the server-managed NarrativeX session. Google access/refresh tokens must never enter Electron.

The local-execution device token is a separate credential used only for device heartbeat/render APIs; it is not the user's OAuth/session token.

## Local-first project storage

Desktop project media is stored under Electron `userData`:

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

`project.manifest.json` maps backend asset IDs to project-relative paths, sizes and SHA-256 checksums. Electron main validates IDs, checksums and workspace boundaries before resolving files. Absolute local filesystem paths are not persisted to the backend.

## Local render execution

The current desktop implementation contains a local project-render foundation:

```text
backend assigns LOCAL_DEVICE render
  -> desktop device claims job
  -> resolve narration/image asset IDs through project.manifest.json
  -> render FFmpeg segments
  -> concatenate video
  -> concatenate narration
  -> mux audio/video
  -> ffprobe final MP4
  -> register checksum-verified local artifact
  -> report progress/completion to backend
```

Lease heartbeats, progress reporting, failure reporting and in-process cancellation are implemented. Process-restart crash recovery/resume remains a hardening item.

Local project rendering is enabled only when FFmpeg is available and:

```text
NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true
```

Relevant configuration:

```text
NARRATIVEX_BACKEND_URL=http://localhost:8080
NARRATIVEX_DESKTOP_HEARTBEAT_MS=15000
NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true
```

## Development

```bash
npm ci
npm run dev
```

Checks:

```bash
npm run type-check
npm run build
```

The desktop client is the migration target and primary editor surface. `app/frontend-web` remains only as a temporary legacy migration client until desktop parity gates are complete; new desktop-only behavior must not be designed around Next.js/browser constraints.
