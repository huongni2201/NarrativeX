# NarrativeX Desktop

NarrativeX Desktop is the only supported NarrativeX editor client. It is built with Electron, React, TypeScript and electron-vite while Spring Boot remains authoritative for project/domain metadata, generation jobs, leases, and durable artifact state.

## Runtime boundary

The app is split into three trust zones:

- **Renderer** — React UI, routing, React Query and editor draft state. No Node.js access and no application authentication/session ownership.
- **Preload** — narrow typed `window.narrativex` bridge with context isolation and no Node integration; Chromium renderer sandboxing is currently disabled for startup compatibility.
- **Main process** — project bytes, ProjectStorage/ProjectCatalog, local device execution, FFmpeg/ffprobe and protected clipboard.

Navigation, window creation, permissions and IPC senders are restricted before privileged operations are accepted.

## Single-user local-first workspace

Per **ADR-0001**, NarrativeX operates as a single-user local-first application. Desktop launches directly into the local project workspace without an account login screen, guest credentials, or session cookies.

```text
startup
  -> initialize Electron main & preload bridges
  -> connect directly to local Spring Boot backend (/api/v1/projects)
  -> load active local project or project catalog
```

External AI provider API keys and machine execution credentials are local runtime configurations managed in Desktop Settings, not user identities. Remote OAuth, guest ownership transfers, and synthetic application sessions have been retired. Desktop preferences and the local project catalog are application-scoped and stay inside this installation; a new machine starts with an empty local workspace.

Final rendering uses an installation's paired executor device. Pairing stores only the device ID and protected device token, then maintains capabilities, heartbeat, render claim, lease, progress, cancellation and recovery state. No application account or session identity is involved.

## Local project storage

Project bytes live under Electron `userData` and are indexed by a schema-versioned local manifest using project-relative paths, size and SHA-256. The local project catalog and per-project snapshots use schema v3; v2 records migrate in place while preserving project metadata, archive state, timestamps and last-opened selection.

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/
  artifacts/
  work/
```

Native import uses a two-phase flow so renderer code never receives an arbitrary absolute path: main inspects/hashes the selection, backend registers the stable media identity, then main commits the bytes into ProjectStorage.

Current storage tooling includes project verification, storage accounting, completed/failed work cleanup and manifest-verified backup/restore/archive-copy foundations.

## Desktop settings

Electron main persists version 4 `desktop-preferences.json` data under `userData`. Settings are application-scoped on the local machine. Legacy version 3 window state migrates without retaining profile or ownership metadata.

Desktop settings currently include:

- main-window normal `x/y/width/height` and maximized state;
- reset window layout.

Window bounds are validated against currently connected displays before restore. A layout saved on a disconnected monitor falls back to a visible current display instead of reopening off-screen.

## Production timeline

The editor consumes backend production timeline data and maintains supported local draft edits. Current foundations include:

- narration-aligned beat timing; beat start/end/duration are derived from the narration word clock and are not render-editable;
- explicit beat media selection/replace flow;
- image/video-aware beat state;
- probed source duration for imported audio/video;
- camera/fit/trim draft state where applicable;
- narration-aware Auto Edit planning with optional style override;
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
- final ffprobe verification of separate audio/video start clocks and durations against the narration master clock;
- `COMPLETED`, `CANCELED`, `FAILED` and retryable/stalled behavior where defined;
- atomic `render.state.json` journaling and unfinished-work discovery;
- immutable segment cache keyed by input/timeline/renderer/output identity;
- checksum-verified local artifact registration;
- in-process cancellation.

Generation and narration jobs use project-scoped SSE snapshots through the Electron main bridge. The worker event outbox and signed callback path feed backend idempotent receipt/finalization; scheduled reconciliation covers missed events. The renderer updates React Query from snapshots, reconnects after stream interruption and keeps a slow GET watchdog; terminal snapshots stop the subscription. Durable job state remains backend/PostgreSQL authority.

Richer recovery/resume UX after abrupt process/OS failure remains roadmap work.

## Configuration

Copy `.env.example` to `.env` for development. `VITE_*` values are build/dev configuration; `NARRATIVEX_*` process variables are optional runtime defaults/overrides.

Important values include:

```text
VITE_API_BASE_URL=http://localhost:8080
VITE_DESKTOP_PROJECT_RENDER_ENABLED=true
VITE_DESKTOP_HEARTBEAT_MS=15000
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
AI/image jobs remain disabled until the generation service advertises a production-ready
image workflow and VieNeu reference audio is mounted. Fake provider output must not be
used as production health or production media.

## Windows packaging

`electron-builder.yml` defines Windows NSIS metadata, application resources, external FFmpeg layout and `narrativex://` protocol registration.

```bash
npm run package:win
```

Production release work still needs full signing, upgrade/auto-update, and release pipeline validation. See `../../docs/product/roadmap.md`.

## Renderer structure and dependency direction

The renderer (`src/renderer/`) is organized by feature ownership:

```text
src/renderer/
  app/         -> DesktopApp, DesktopRouter, providers
  api/         -> cross-feature transport only (client.ts, guards.ts)
  components/  -> domain-free UI primitives (components/ui/)
  features/    -> feature slices (api, queries, model, components, screens, store)
  lib/         -> small utilities genuinely shared across unrelated features
```

Dependency direction inside features:
- `screen -> queries -> components -> model`
- `queries -> api`, and `queries -> model` only when pure helpers are needed
- `components -> model -> Desktop API types / pure libraries`
- Never import screens across features; compose cross-feature workflows in workspace containers.
- Model code (`model/`) remains deterministic and React-lifecycle-free.

## Architecture rule

`app/desktop` is the only supported editor client. Do not recreate a parallel browser editor without an explicit ADR. Native filesystem integration and local final FFmpeg execution belong in Electron main, never unrestricted renderer code.
