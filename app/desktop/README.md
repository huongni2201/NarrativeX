# NarrativeX Desktop

NarrativeX Desktop is the only supported NarrativeX editor client. It is built with Electron, React, TypeScript and electron-vite while Spring Boot remains authoritative for project/domain metadata, generation jobs, leases, and durable artifact state.

## Runtime boundary

The app is split into three trust zones:

- **Renderer** — React UI, routing, React Query and editor draft state. No Node.js access and no direct ownership of backend session cookies.
- **Preload** — narrow typed `window.narrativex` bridge with context isolation and no Node integration; Chromium renderer sandboxing is currently disabled for startup compatibility.
- **Main process** — project bytes, ProjectStorage/ProjectCatalog, local device execution, FFmpeg/ffprobe, Gemini Web Chrome/CDP automation and protected clipboard.

Navigation, window creation, permissions and IPC senders are restricted before privileged operations are accepted.

## Single-user local-first workspace

Per **ADR-0030**, NarrativeX operates as a single-user local-first application. Desktop launches directly into the local project workspace without an account login screen, guest credentials, or session cookies.

```text
startup
  -> initialize Electron main & preload bridges
  -> connect directly to local Spring Boot backend (/api/v1/projects)
  -> load active local project or project catalog
```

External AI provider API keys and machine execution credentials are local runtime configurations managed in Desktop Settings, not user identities. Remote OAuth, guest ownership transfers, and synthetic user sessions have been retired.

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

The Chapter setup exposes `GEMINI_WEB` as a manual Desktop provider. It always uses `GENERATE_NEW` and sends the user to Storyboard for single-beat Generate or the bounded-parallel `Gemini All` queue; it does not create an API media job or cost estimate.

Each NarrativeX user has one Gemini browser profile by default and may add more from Desktop Settings. Every browser profile owns an independent Chrome process lifecycle, persistent `--user-data-dir`, local CDP port, automation session and download/slot namespace. Browser profile roots are device-local and user-local. The first browser is `Browser 1`; at least one browser must remain.

The user signs in manually inside each selected Chrome profile. NarrativeX never stores or autofills Google passwords, OAuth tokens or browser cookies in Desktop preferences. Chrome keeps its own cookies/local storage in the profile directory so login may survive NarrativeX/Chrome restart until Google expires, revokes or re-verifies the session. Settings derives `Logged in`, `Not logged in` and `Unavailable` state from the live Gemini page instead of trusting a saved login boolean.

Settings provides per-browser `Open`, `Login`, `Reset login` and `Remove` actions plus `Add browser`. `Login` is shown for a browser detected as not logged in. Reset Login affects only the selected browser profile. Resetting Gemini concurrency or all normal personalized settings does not silently delete browser login profiles. Removing/resetting a browser while it owns active generation leases is rejected.

Electron main automatically selects an authenticated browser for generation; renderer generation requests remain browser-agnostic. Scheduling favors the least-active ready browser and rotates equal-load choices. A request that fails after submission is not silently replayed through another browser/account.

Character defaults to 2 concurrent Gemini tabs and Storyboard defaults to 4, configurable from 1 to 8. These are **global per-user concurrency limits across the complete browser pool**, not per-browser multipliers. For example, two signed-in browsers with Storyboard set to 4 still allow at most four Storyboard generations at once, not eight. Within each browser host, prompts, target identity, captures and download namespaces remain slot-scoped.

Chrome uses background-throttling safeguards and brings the requested page to the front before submit when required. `NARRATIVEX_CHROME_PATH` can override Chrome discovery.

The main process applies the locked Chinese romantic-fantasy manhua series style wrapper, treats the scene block as untrusted narrative input, waits for a full-size download, validates the image and SHA-256, then exposes only a short-lived sender-bound selection token to the renderer. The renderer registers asset metadata with the backend and asks main to commit bytes into ProjectStorage.

The pre-browser-pool single profile is migrated to the current user's Browser 1 through an idempotent, allowlisted migration of known Gemini automation entries. Existing destination data is never overwritten and unknown legacy files are left untouched.

## Desktop settings

Electron main persists versioned `desktop-preferences.json` data under `userData`. Settings are installation-scoped on the local machine.

Desktop settings currently include:

- Character and Storyboard Gemini Web global concurrency;
- local Gemini browser registry metadata;
- main-window normal `x/y/width/height` and maximized state;
- reset Gemini concurrency back to environment defaults while preserving browser profiles;
- reset window layout;
- reset normal desktop settings while preserving explicit Gemini browser login/profile data.

Chrome-owned authentication/session bytes are not stored in `desktop-preferences.json`; they live inside isolated browser profile directories under the Gemini Web local root.

Window bounds are validated against currently connected displays before restore. A layout saved on a disconnected monitor falls back to a visible current display instead of reopening off-screen.

## Production timeline

The editor consumes backend production timeline data and maintains supported local draft edits. Current foundations include:

- narration-aligned beat timing; beat start/end/duration are derived from the narration word clock and are not render-editable;
- explicit beat media selection/replace flow;
- image/video-aware beat state;
- probed source duration for imported audio/video;
- camera/fit/trim draft state where applicable;
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
- final ffprobe verification of separate audio/video start clocks and durations against the narration master clock;
- `COMPLETED`, `CANCELED`, `FAILED` and retryable/stalled behavior where defined;
- atomic `render.state.json` journaling and unfinished-work discovery;
- immutable segment cache keyed by input/timeline/renderer/output identity;
- checksum-verified local artifact registration;
- in-process cancellation.

Generation and narration jobs use authenticated owner-scoped SSE snapshots through the Electron main bridge. The renderer updates React Query from snapshots, reconnects after stream interruption and keeps a slow GET watchdog; terminal snapshots stop the subscription. Durable job state remains backend/PostgreSQL authority.

Richer recovery/resume UX after abrupt process/OS failure remains roadmap work.

## Configuration

Copy `.env.example` to `.env` for development. `VITE_*` values are build/dev configuration; `NARRATIVEX_*` process variables are optional runtime defaults/overrides. For personalized Gemini concurrency, a saved user setting takes precedence over the corresponding environment default.

Important values include:

```text
VITE_API_BASE_URL=http://localhost:8080
VITE_DESKTOP_PROJECT_RENDER_ENABLED=true
VITE_DESKTOP_HEARTBEAT_MS=15000
NARRATIVEX_CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
NARRATIVEX_GEMINI_CHARACTER_TAB_COUNT=2
NARRATIVEX_GEMINI_STORYBOARD_TAB_COUNT=4
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
AI/image jobs remain disabled until the production Vertex AI credential and VieNeu
reference-audio files are mounted explicitly. Fake provider output must not be used
as production health or production media.

## Windows packaging

`electron-builder.yml` defines Windows NSIS metadata, application resources, external FFmpeg layout and `narrativex://` protocol registration.

```bash
npm run package:win
```

Production release work still needs full signing, upgrade/auto-update, and release pipeline validation. See `../../documentation/product/ROADMAP.md`.

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
- `components -> model -> shared contracts / pure libraries`
- Never import screens across features; compose cross-feature workflows in workspace containers.
- Model code (`model/`) remains deterministic and React-lifecycle-free.

## Architecture rule

`app/desktop` is the only supported editor client. Do not recreate a parallel browser editor without an explicit ADR. Native filesystem integration and local final FFmpeg execution belong in Electron main, never unrestricted renderer code.
