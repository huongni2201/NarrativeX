# NarrativeX Technology Stack — V1.11

Canonical authority: [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md).

Executable manifests are authoritative for exact dependency versions. This file summarizes the current stack at docs checkpoint `0aca94e6eef07158e161cd67c648671e74055473` (2026-08-26).

| Layer | Current stack | Current role |
|---|---|---|
| Desktop | Electron 43.4.1, Electron Vite 5.0.0, React/React DOM 19.2.8, React Router DOM 7.18.2, TypeScript 7.0.2 | only supported editor client and local native-execution boundary |
| Desktop state/data | TanStack React Query 5.102.3, Zustand 5.0.15 | backend query/cache and local editor state |
| Desktop UI | Tailwind CSS 4.3.3, `@tailwindcss/vite` 4.3.3, source-owned shadcn-style primitives, Radix UI, CVA, clsx, tailwind-merge, Lucide 1.34.0, Sonner 2.0.8 | accessible renderer component vocabulary and semantic styling |
| Browser OAuth flow | Spring Security OAuth2/OIDC endpoints | backend authentication flow only; no browser editor |
| Backend | Java 25, Spring Boot 4.1.0, Security/OAuth2, Spring Session Redis, Actuator | modular monolith, auth/ownership/policy and durable orchestration authority |
| Persistence | PostgreSQL + Flyway + MyBatis Spring Boot 4.1.0 + explicit SQL | sole production application persistence path |
| Redis | Spring Data Redis + Spring Session Redis | server sessions and transient/non-authoritative state |
| Worker | Python 3.12+, Pydantic 2.7.0, pydantic-settings 2.2.0, HTTPX 0.27.0, asyncpg 0.30.0, google-auth 2.35.0 | asynchronous analysis/translation/image/narration/media-validation execution |
| Worker media/AI extras | boto3 1.40.0, Pillow 10.0.0, VieNeu 3.3.0, torch/torchaudio 2.8.0, pydub 0.25.1 | generated-media transport, narration and image/media processing |
| Shared client contracts | `packages/client-contracts` | typed Desktop/backend contracts |
| AI analysis | Vertex Gemini | structured Chapter analysis |
| Image generation | Vertex Gemini image execution | provider execution plus Desktop materialization |
| Narration | VieNeu + user-provided audio | generated/imported narration; narration remains the master clock |
| Remote generated-media transport | Cloudflare R2 | durable transport for AI-generated image/narration bytes before Desktop materialization |
| Desktop project storage | Electron `userData` + `project.manifest.json` | local-first project media, backups, render work/cache and final artifacts |
| Desktop deterministic render | FFmpeg + ffprobe from Electron main | backend-assigned lease-controlled final rendering and local MP4 output |

## Desktop trust boundary

```text
renderer
  -> React UI / routes / query state / timeline state
  -> no unrestricted Node.js

preload
  -> narrow typed capability bridge

main
  -> backend session transport
  -> stable guest installation credential
  -> system-browser OAuth/deep link
  -> native files and ProjectStorage
  -> device execution
  -> FFmpeg/ffprobe
```

The renderer must not become a second source of truth for Projects, Chapters, storyboard state, assets, entitlements or durable render state.

## Authentication status

Desktop is guest-first. A stable installation-scoped guest identity provides ownership continuity for free workspace usage. Google remains the only end-user account sign-in provider and is required for backend-gated account/provider-consuming operations.

The guest installation secret, signed-in user session and local-execution device credential are separate security concepts. Google access/refresh tokens never enter Electron.

## Renderer UI structure

The current renderer uses feature-oriented modules plus source-owned primitives under `app/desktop/src/renderer/components/ui`.

- Tailwind CSS 4 is compiled by `@tailwindcss/vite`.
- shadcn/ui is used as a source distribution model rather than a runtime dependency.
- Radix primitives provide accessibility behavior for adopted controls.
- CVA/clsx/tailwind-merge provide variants and class composition.
- `styles.css` should remain focused on tokens/theme mappings/global accessibility rules rather than page-specific styling.

See `documentation/codebase/DESKTOP_RENDERER_STRUCTURE.md` and ADR-0017 for the current component/feature boundary.

## Desktop local storage/render status

Implemented foundations include:

- schema-versioned local project manifest and project catalog;
- native local import/registration without renderer path exposure;
- image/narration local materialization for implemented Desktop flows;
- render preflight, local device claim/lease and FFmpeg execution;
- atomic render journal discovery;
- render segment cache;
- storage verification/cleanup;
- workspace backup/restore/archive-copy;
- local checksum-verified final artifact metadata registration;
- direct local playback/export of the final MP4.

Production release hardening, abrupt-process recovery UX and richer editor/review workflows remain roadmap work.

## Persistence status

Production persistence is MyBatis + explicit PostgreSQL SQL. The backend build contains no JPA persistence dependency and application persistence does not use direct `JdbcTemplate` as a parallel production path.

Current Flyway sequence is V1-V5, with V1-V3 frozen and V4+ append-only feature migrations.
