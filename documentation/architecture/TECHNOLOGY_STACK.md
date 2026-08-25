# NarrativeX Technology Stack — V1.11

Canonical authority: [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md).

Desktop client/media/render boundaries are governed by ADR-0010, ADR-0011 and ADR-0012. ADR-0003 continues to govern retained cloud/worker storage/provider behavior.

| Layer | Current stack | Current role |
|---|---|---|
| Desktop | Electron 37, Electron Vite 4, React 19, TypeScript, React Router, TanStack Query, Zustand, Lucide, Tailwind CSS 4, shadcn/ui source components, Radix UI, CVA, clsx, tailwind-merge | **Only supported editor client**; native filesystem/project storage, system-browser auth callback and local execution through Electron main |
| Browser OAuth flow | Spring Security OAuth2/OIDC endpoints | Backend authentication flow only; no supported browser editor client |
| Backend | Java 25, Spring Boot 4.1, Security/OAuth2, Spring Session Redis, Actuator | modular monolith, ownership/policy, durable orchestration, MediaPlan/job/lease authority |
| Persistence | PostgreSQL 18 target, Flyway, MyBatis + explicit SQL | sole production persistence path for durable application/control metadata |
| Redis | Spring Data Redis + Spring Session Redis | server-managed sessions and transient/non-authoritative hints |
| Worker | Python 3.12+, Pydantic, HTTPX, asyncpg, google-auth, boto3 | async provider/media execution and retained cloud/server paths |
| Shared client contracts | `packages/client-contracts` | typed backend contracts consumed by Desktop |
| AI analysis | Vertex Gemini | structured Chapter analysis |
| Image generation | Vertex Gemini image execution | provider execution foundation; Desktop target materializes/registers project result bytes locally |
| Narration | Google TTS + local VieNeu + uploaded-audio timeline/alignment contracts | generated/user audio; Desktop target registers project narration locally |
| Desktop project storage | Electron `userData` + `project.manifest.json` | local-first images/audio/video/final artifacts using relative paths + SHA-256 |
| Desktop deterministic render | FFmpeg + ffprobe from Electron main | backend-assigned `LOCAL_DEVICE` project render; local final artifact |
| Cloud pipeline storage | Cloudflare R2 | retained cloud/legacy pipeline media and deliberately shared reusable media |
| Cloud final video storage | Google Drive | retained cloud/legacy final MP4 path |
| Optional I2V | Wan-compatible adapter foundation | deferred/fast-follow |

## Desktop client boundary

`app/desktop` is the only supported editor client.

```text
renderer
  -> UI / routes / React Query / Zustand / timeline / preview
  -> no unrestricted Node.js

preload
  -> narrow typed capability bridge

main
  -> BrowserWindow security
  -> system-browser Google OAuth start
  -> narrativex:// callback handling
  -> native file/folder dialogs
  -> local ProjectStorage manifest
  -> protected device identity
  -> local execution heartbeat/claim/progress
  -> FFmpeg/ffprobe execution
```

The renderer must not become an alternative source of truth for Projects, Chapters, Scenes, VisualBeats, assets, entitlements or durable render state.

## Desktop renderer UI stack

The renderer uses a local source-owned component layer under
`app/desktop/src/renderer/components/ui`:

- Tailwind CSS 4 is compiled by `@tailwindcss/vite`; semantic utility tokens map to the existing NarrativeX CSS variables.
- shadcn/ui is used as a source distribution model. There is no locked runtime UI library or remote component registry in the Desktop build.
- Radix UI supplies keyboard navigation, focus management, dialog focus trapping, select behavior and tooltip behavior for the adopted primitives.
- `class-variance-authority`, `clsx` and `tailwind-merge` provide typed variants and safe class composition through `src/renderer/lib/utils.ts`.
- Renderer styling is now utility-first: `styles.css` contains only design tokens, Tailwind theme mappings and global accessibility/base rules. Timeline geometry, canvas art direction, dense panels, projects and auth screens use Tailwind utilities and source-owned primitives.

The migration covers Button, Card, Dialog, DropdownMenu, Input, Select, Tabs, Textarea and Tooltip. Domain/API behavior remains unchanged while the renderer converges on one accessible component vocabulary.

## Authentication status

Google is the only user-facing login provider.

Desktop uses:

```text
system browser
  -> /api/v1/auth/desktop/start
  -> Google OIDC
  -> narrativex://auth/callback?code=...
  -> /api/v1/auth/desktop/exchange
  -> server-managed NarrativeX session
```

Google access/refresh tokens do not enter Electron. Local-execution device credentials are separate from user authentication and are used only for device/job APIs.

## Desktop local storage/render status

Implemented foundation at `main` commit `751f006634218efb2c398fc00c2cbfecd25e1eac`:

- schema-versioned local project manifest;
- project-relative asset/artifact paths;
- path-boundary, file-size and SHA-256 validation;
- local device pairing/heartbeat;
- backend-assigned local project-render claim;
- lease heartbeat/progress/failure/completion;
- FFmpeg/ffprobe probing;
- segment render → video concat → narration concat → mux → ffprobe → local artifact registration;
- in-process cancellation.

Local project rendering requires FFmpeg/ffprobe and `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true`.

Process-restart recovery and complete local materialization of every generation/import path remain incomplete.

## Storage by execution mode

### Primary Desktop path

```text
Project images/audio/video  -> local project workspace
Render intermediates        -> local project workspace/work
Final MP4                   -> local project workspace/artifacts
Business/job metadata       -> PostgreSQL
```

### Retained cloud/legacy path

```text
Pipeline media              -> R2
Final cloud-rendered MP4    -> Google Drive
Business/job metadata       -> PostgreSQL
Worker scratch              -> ephemeral local filesystem
```

Do not describe R2/Google Drive as mandatory storage for Desktop project media.

## Persistence status

Production persistence uses MyBatis + explicit PostgreSQL SQL. The backend build has no JPA dependency and production source has no direct `JdbcTemplate` persistence.

## Narration status

Narration timing remains authoritative. `USER_PROVIDED_AUDIO` supports ordered parts/global-clock planning and TTS bypass; full multi-part render behavior must be described according to the execution path actually implemented.

## Current client direction

`app/desktop` is the only supported editor client. The former `app/frontend-web` client was removed after the repository's parity, packaging and reliability/dependency gates; browser endpoints that remain are backend authentication flow, not a browser editor surface.
