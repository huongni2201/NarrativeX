# NarrativeX Technology Stack — V1.11

Canonical authority: [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md).

Executable manifests are authoritative for exact dependency versions. This file summarizes the audited stack at code checkpoint `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e` (2026-08-28).

| Layer | Current stack | Current role |
|---|---|---|
| Desktop | Electron 43.x, Electron Vite 5.x, React/React DOM 19.x, React Router DOM 7.x, TypeScript 7.x | only supported editor client and local native-execution boundary |
| Desktop state/data | TanStack React Query 5.x, Zustand 5.x | backend query/cache and local editor/draft state |
| Desktop UI | Tailwind CSS 4.x, source-owned shadcn-style primitives, Radix UI, CVA, clsx, tailwind-merge, Lucide, Sonner | accessible renderer component vocabulary and semantic styling |
| Browser OAuth flow | Spring Security OAuth2/OIDC endpoints | backend authentication flow only; no browser editor |
| Backend | Java 25, Spring Boot 4.1.x, Security/OAuth2, Spring Session JDBC, Actuator | modular monolith, auth/ownership/policy and durable orchestration authority |
| Persistence | PostgreSQL + Flyway + MyBatis + explicit SQL + Spring Session JDBC | sole production application persistence path, including durable jobs, sessions and one-time OAuth handoffs |
| Queue execution | PostgreSQL polling + row locking/leases | workers claim durable jobs directly; no Redis/broker/NOTIFY dependency |
| Worker | Python >=3.12, Pydantic 2.7, pydantic-settings 2.2, HTTPX 0.27, asyncpg 0.30, google-auth 2.35 | asynchronous analysis/image/narration/media-validation execution |
| Worker media/AI extras | boto3, Pillow, VieNeu, torch/torchaudio, numpy, pydub | generated-media transport, narration and image/media processing |
| Shared client contracts | `packages/client-contracts` | typed Desktop/backend contracts |
| AI analysis | Vertex Gemini provider path | structured Chapter analysis from saved Chapter source |
| Image generation | Vertex/API worker execution + Gemini Web Chrome/CDP Desktop automation | API jobs use durable worker execution; Gemini Web is a per-Visual-Beat Desktop-main path with local materialization |
| Narration | VieNeu/provider execution + user-provided audio foundations | generated/imported narration from saved Chapter content; persisted alignment is timing evidence |
| Remote generated-media transport | Cloudflare R2 | transport/durability for generated image/narration bytes before Desktop materialization when required |
| Desktop project storage | Electron `userData` + `project.manifest.json` | local-first project media, backups, render work/cache and final artifacts |
| Desktop deterministic render | FFmpeg + ffprobe from Electron main | backend-assigned lease-controlled final rendering and local MP4 output |

Redis is intentionally not part of the MVP runtime. Translation/content-variant infrastructure is also intentionally absent from the current product baseline. Adding either later requires an explicit architecture/product decision.

## Version policy

This document intentionally uses major/minor families for fast-moving frontend packages. Exact dependency pins live in executable manifests/lockfiles:

```text
app/desktop/package.json
app/desktop/package-lock.json
app/ai-worker/pyproject.toml
app/backend-service/pom.xml
```

Do not maintain a second hand-written exact dependency matrix that can drift from those files.

## Worker runtime roles

Current `narrativex_worker.__main__` may start:

```text
analysis
narration
media-validation
image-generation
```

There is no current Python final-render worker role. Final project FFmpeg execution belongs to Electron main.

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
  -> visible Chrome/CDP Gemini Web automation
  -> Character reference attachment + network output capture
  -> protected system clipboard write
```

The renderer must not become a second source of truth for Projects, Chapters, storyboard state, assets, entitlements or durable render state.

## Authentication status

Desktop is guest-first. A stable installation-scoped guest identity provides ownership continuity for free workspace usage. Google remains the only end-user account sign-in provider and is required for backend-gated account/provider-consuming operations.

The guest installation secret, signed-in user session and local-execution device credential are separate security concepts. Google access/refresh tokens never enter Electron. `NX_SESSION` state and one-time Desktop OAuth handoffs are persisted in PostgreSQL.

## Visual Beat timing status

Current stack capabilities include semantic VisualBeat analysis, narration alignment persistence, immutable MediaPlan timing and generic production-timeline fallback geometry.

Not yet complete at the audited checkpoint:

```text
deterministic VisualBeat text_start/text_end
  -> source-compatible narration reconciliation
  -> exact draft audio_start_ms/audio_end_ms
  -> fully verified narration-clock-authoritative draft preview
```

Do not infer exact VisualBeat alignment merely from Pydantic/narration helpers or nullable database columns.

## Renderer UI structure

The renderer uses feature-oriented modules plus source-owned primitives under `app/desktop/src/renderer/components/ui`.

- Tailwind CSS 4 is compiled through the current Vite integration.
- shadcn/ui is used as a source distribution model rather than a runtime architecture dependency.
- Radix primitives provide accessibility behavior for adopted controls.
- CVA/clsx/tailwind-merge provide variants and class composition.
- `styles.css` should remain focused on tokens/theme/global accessibility rules rather than page-specific styling.

See `../codebase/DESKTOP_RENDERER_STRUCTURE.md` and ADR-0017 for component/feature boundaries.

## Desktop local storage/render status

Implemented foundations include:

- schema-versioned local project manifest and project catalog;
- native local import/registration without renderer path exposure;
- image/narration local materialization for implemented Desktop flows;
- Gemini Web reference-aware generation and checksum-verified local commit;
- render preflight, local device claim/lease and FFmpeg execution;
- atomic render journal discovery;
- render segment cache;
- storage verification/cleanup;
- workspace backup/restore/archive-copy;
- local checksum-verified final artifact metadata registration;
- direct local playback/export of final MP4;
- Auto Edit planning, immutable subtitle snapshots and local UTF-8 SRT generation;
- authenticated generation SSE with Desktop reconnect/watchdog fallback;
- imported audio/video duration probing and custom voice preview foundations.

Production release hardening, exact draft VisualBeat audio timing, abrupt-process recovery UX and richer editor/review workflows remain roadmap work.

## Persistence status

Production persistence is MyBatis + explicit PostgreSQL SQL. The backend build contains no JPA production persistence path and application code must not add direct `JdbcTemplate` as a parallel domain persistence boundary.

The clean pre-release baseline is V1-V8. V1-V6 separate schema/database responsibilities, V7 contains indexes/invariants and V8 contains deterministic catalog seeds. After the first production deployment, freeze applied migrations and evolve append-only from V9+.
