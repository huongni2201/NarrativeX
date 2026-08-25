# NarrativeX Desktop

NarrativeX Desktop is the only editor client for editing and locally rendering NarrativeX projects. It is built with Electron, React, TypeScript and electron-vite while the Spring backend remains the authoritative source for users, projects, generation jobs and shared domain state.

## Runtime boundary

The desktop app is intentionally split into three trust zones:

- **Renderer** — React UI only. It does not receive Node.js access or backend session cookies directly.
- **Preload** — exposes the narrow typed `window.narrativex` bridge with `contextIsolation: true` and sandboxing enabled.
- **Main process** — owns privileged filesystem access, dialogs, backend session transport, device pairing, local asset storage and FFmpeg execution.

Renderer navigation, window creation, webview attachment, permission requests and IPC senders are restricted before privileged operations are accepted.

## Authentication

Desktop authentication is Google OAuth only. The system browser completes OAuth and returns a one-time handoff code through:

```text
narrativex://auth/callback?code=...
```

The code is exchanged by the desktop app for the normal Spring session. Backend API calls from the renderer are proxied through Electron main so a packaged `file://` renderer does not own or manually copy session cookies.

## Local rendering

The desktop main process can execute final project renders with FFmpeg when `PROJECT_RENDER` is enabled. The backend still owns the durable render job, input snapshot, lease and terminal status while the desktop owns local execution and artifact bytes.

The local render engine currently provides:

- project/device-scoped render claims and leases;
- narration as the master clock;
- project aspect-ratio aware output dimensions;
- FFmpeg/ffprobe runtime discovery with configured, bundled and system fallbacks;
- progress heartbeats and lease-loss handling;
- explicit `COMPLETED`, `CANCELED`, `FAILED` and retryable `STALLED` outcomes;
- immutable local asset/artifact registration with SHA-256 verification;
- local project manifest updates serialized per project.

## Configuration

Copy `.env.example` to `.env` for development. electron-vite `VITE_*` values are build/dev configuration; `NARRATIVEX_*` process variables are optional runtime overrides and take precedence.

Important values:

```text
VITE_API_BASE_URL=http://localhost:8080
VITE_DESKTOP_PROJECT_RENDER_ENABLED=true
VITE_DESKTOP_HEARTBEAT_MS=15000
```

Remote backend origins must use HTTPS. Plain HTTP is accepted only for loopback development hosts.

FFmpeg can be resolved from:

1. `NARRATIVEX_FFMPEG_PATH` / `NARRATIVEX_FFPROBE_PATH`;
2. packaged `${process.resourcesPath}/ffmpeg` binaries copied through `extraResources`;
3. `ffmpeg` / `ffprobe` available on `PATH`.

Optional bundled Windows binaries belong in `resources/ffmpeg/ffmpeg.exe` and `resources/ffmpeg/ffprobe.exe`. The directory is excluded from `app.asar` so the executables remain runnable after installation.

## Development

From `app/desktop`:

```bash
npm ci
npm run type-check
npm run build
npm run dev
```

Or run the static validation and build together:

```bash
npm run check
```

`type-check` explicitly checks both `tsconfig.node.json` and `tsconfig.web.json`; do not replace it with a bare `tsc --noEmit` against the root solution config.

## Windows packaging

`electron-builder.yml` defines the Windows NSIS application metadata, NarrativeX icon, external FFmpeg resource layout and `narrativex://` protocol registration.

Create a Windows installer with:

```bash
npm run package:win
```

The script runs `npm run check` first and then invokes the stable `electron-builder@26.15.7` release explicitly. This avoids changing the existing npm lockfile while keeping the packaging tool version fixed. Before a signed production release, move `electron-builder` into `devDependencies` and regenerate/commit `package-lock.json` with npm so the complete packaging dependency graph is locked as well.

## Client architecture rule

`app/frontend-web` has been removed. New editor UX, local filesystem integration, authentication UI and final FFmpeg execution belong in `app/desktop`. Do not recreate a parallel browser editor without an explicit architecture decision.
