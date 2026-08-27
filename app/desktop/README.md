# NarrativeX Desktop

NarrativeX Desktop is the only supported NarrativeX editor client. It is built with Electron, React, TypeScript and electron-vite while Spring Boot remains authoritative for users/guests, ownership, project/domain metadata, generation jobs and shared durable state.

## Runtime boundary

The app is split into three trust zones:

- **Renderer** — React UI, routing, React Query and editor draft state. No Node.js access and no direct ownership of backend session cookies.
- **Preload** — narrow typed `window.narrativex` bridge with context isolation and no Node integration; Chromium renderer sandboxing is currently disabled for startup compatibility.
- **Main process** — backend session transport, stable guest credential, system-browser auth, native filesystem/dialogs, ProjectStorage/ProjectCatalog, local device execution, FFmpeg/ffprobe, Gemini Web Chrome/CDP automation and protected clipboard.

Navigation, window creation, permissions and IPC senders are restricted before privileged operations are accepted.

## Guest-first authentication

Desktop does not require an account login screen before entering the workspace.

```text
startup
  -> reuse GET /api/v1/auth/me session when valid
  -> otherwise POST /api/v1/auth/desktop/guest
  -> main injects installation deviceId + protected guest secret
  -> backend restores/creates the stable ROLE_GUEST identity
```

The guest credential is installation-scoped, stored through Electron secure storage and never exposed to renderer code. It exists for ownership/session continuity; it is not a second end-user login provider.

Google is the only account sign-in provider. Backend-gated account/provider-consuming actions return `AUTHENTICATION_REQUIRED`, causing the renderer to open the LoginModal over the current route.

```text
LoginModal
  -> main opens /api/v1/auth/desktop/start in system browser
  -> Google OIDC
  -> narrativex://auth/callback?code=...
  -> main exchanges the one-time code
  -> backend transfers eligible guest-owned workspace metadata
  -> ROLE_USER session
  -> renderer refetches without losing the active project/editor route
```

Google access/refresh tokens never enter Electron. Guest installation credentials, user session state and local-execution device credentials are separate concepts.

## Local project storage

Project bytes live under Electron `userData` and are indexed by a schema-versioned local manifest using project-relative paths, size and SHA-256.

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/
  artifacts/
  work/
```

Native import uses a two-phase flow so renderer code never receives an arbitrary absolute path: main inspects/hashes the selection, backend registers the stable media identity, then main commits the bytes into ProjectStorage.

Current storage tooling includes project verification, storage accounting, completed/failed work cleanup and manifest-verified backup/restore/archive-copy foundations.

## Gemini Web image generation

The Chapter setup exposes `GEMINI_WEB` as a manual Desktop provider. It always uses `GENERATE_NEW` and sends the user to Storyboard for single-beat Generate or the serial `Gemini All` queue; it does not create an API media job or cost estimate. Electron main owns a visible Chrome profile and drives Gemini through local CDP. The user signs in manually when needed; NarrativeX never fills provider credentials.

The main process applies the locked Chinese romantic-fantasy manhua series style wrapper, treats the scene block as untrusted narrative input, waits for a full-size download, validates the image and SHA-256, then exposes only a short-lived sender-bound selection token to the renderer. The renderer registers asset metadata with the backend and asks main to commit bytes into ProjectStorage. `NARRATIVEX_CHROME_PATH` can override Chrome discovery.

## Production timeline

The editor consumes backend production timeline data and maintains supported local draft edits. Current foundations include:

- narration-aligned beat timing;
- explicit beat media selection/replace flow;
- image/video-aware beat state;
- probed source duration for imported audio/video;
- duration/camera/fit draft state where applicable;
- narration-aware Auto Edit planning with optional style override;
- typed undo/redo/reset command history;
- render submission based on authoritative IDs/production choices rather than local machine paths.

## Local rendering

Electron main can execute final project renders with FFmpeg when project rendering is enabled. The backend owns the durable render job, input snapshot, assignment, lease and terminal state; Desktop owns local execution and artifact bytes.

Current foundations include:

- project/device-scoped render claims and leases;
- narration as the master clock;
- aspect-ratio aware output;
- FFmpeg/ffprobe discovery from configured, bundled or system paths;
- preflight for runtime, executor, disk and local asset integrity;
- progress heartbeat and lease-loss handling;
- immutable narration subtitle snapshot to local UTF-8 SRT track during render;
- `COMPLETED`, `CANCELED`, `FAILED` and retryable/stalled behavior where defined;
- atomic `render.state.json` journaling and unfinished-work discovery;
- immutable segment cache keyed by input/timeline/renderer/output identity;
- checksum-verified local artifact registration;
- in-process cancellation.

Generation and narration jobs use authenticated owner-scoped SSE snapshots through the Electron main bridge. The renderer updates React Query from snapshots, reconnects after stream interruption and keeps a slow GET watchdog; terminal snapshots stop the subscription. Durable job state remains backend/PostgreSQL authority.

Richer recovery/resume UX after abrupt process/OS failure remains roadmap work.

## Configuration

Copy `.env.example` to `.env` for development. `VITE_*` values are build/dev configuration; `NARRATIVEX_*` process variables are optional runtime overrides and take precedence.

Important values include:

```text
VITE_API_BASE_URL=http://localhost:8080
VITE_DESKTOP_PROJECT_RENDER_ENABLED=true
VITE_DESKTOP_HEARTBEAT_MS=15000
NARRATIVEX_CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
```

Remote backend origins must use HTTPS. Plain HTTP is accepted only for loopback development hosts.

FFmpeg resolution order:

1. `NARRATIVEX_FFMPEG_PATH` / `NARRATIVEX_FFPROBE_PATH`;
2. packaged `${process.resourcesPath}/ffmpeg` binaries;
3. `ffmpeg` / `ffprobe` on `PATH`.

## Development

```bash
npm ci
npm run check
npm run dev
```

`npm run check` verifies dependency-lock expectations, tests, type checks and the production build. Exact dependency versions are authoritative in `package.json` / `package-lock.json` and the dependency verification scripts; a separate dependency-migration document is intentionally not maintained.

For local Desktop development against the Docker backend, use the ignored
`app/desktop/.env` file (copy `.env.example` if it does not exist) with
`VITE_API_BASE_URL=http://localhost:8080`, then start the local Compose override
from the repository root:

```bash
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.local.yml up -d --no-build
```

The local override keeps the backend on the loopback origin and starts all worker
processes in development mode without external provider execution. The narration
worker uses a deterministic fake TTS adapter only in this local development mode;
AI/image jobs remain disabled until the production GCP credential and VieNeu
reference-audio files are mounted explicitly. Fake provider output must not be used
as production health or production media.

## Windows packaging

`electron-builder.yml` defines Windows NSIS metadata, application resources, external FFmpeg layout and `narrativex://` protocol registration.

```bash
npm run package:win
```

Production release work still needs full signing/upgrade/auto-update and packaged OAuth/protocol validation. See `../../documentation/product/ROADMAP.md`.

## Architecture rule

`app/desktop` is the only supported editor client. Do not recreate a parallel browser editor without an explicit ADR. Native filesystem integration and local final FFmpeg execution belong in Electron main, never unrestricted renderer code.
