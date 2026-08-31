# NarrativeX Technology Stack — V1.12

Canonical authority: [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md).

Executable manifests are authoritative for exact dependency versions. This file summarizes the current stack after the PostgreSQL-only, local-project-media, voice-reference-scope and source-anchored timing refactors.

| Layer | Current stack | Current role |
|---|---|---|
| Desktop | Electron 43.4.1, Electron Vite 5.0.0, React/React DOM 19.2.8, React Router DOM 7.18.2, TypeScript 7.0.2 | only supported editor client and local native-execution boundary |
| Desktop state/data | TanStack React Query 5.102.3, Zustand 5.0.15 | backend query/cache and local editor state |
| Desktop UI | Tailwind CSS 4.3.3, `@tailwindcss/vite` 4.3.3, source-owned shadcn-style primitives, Radix UI, CVA, clsx, tailwind-merge, Lucide 1.34.0, Sonner 2.0.8 | accessible renderer component vocabulary and semantic styling |
| Browser OAuth flow | Spring Security OAuth2/OIDC endpoints | backend authentication flow only; no browser editor |
| Backend | Java 25, Spring Boot 4.1.0, Security/OAuth2, Spring Session JDBC, Actuator | modular monolith, auth/ownership/policy and durable orchestration authority |
| Persistence | PostgreSQL + Flyway + MyBatis Spring Boot 4.1.0 + explicit SQL + Spring Session JDBC | sole production application persistence path, including durable queues, server sessions and one-time OAuth handoffs |
| Queue execution | PostgreSQL polling + row locking/leases | workers claim durable jobs directly; no Redis/broker/NOTIFY dependency |
| Worker | Python 3.12+, Pydantic 2.7.0, pydantic-settings 2.2.0, HTTPX 0.27.0, asyncpg 0.30.0, google-auth 2.35.0 | asynchronous analysis/image/narration/media-validation execution |
| Worker media/AI extras | boto3 1.40.0, Pillow 10.0.0, VieNeu 3.3.0, torch/torchaudio 2.8.0, pydub 0.25.1 | voice-reference R2 access, narration and image/media processing |
| Shared client contracts | `packages/client-contracts` | typed Desktop/backend contracts |
| AI analysis | Vertex Gemini | structured Chapter analysis from saved Chapter source |
| Image generation | Vertex Gemini worker execution + Gemini Web Chrome/CDP Desktop automation | API jobs and Desktop web generation; accepted project image results are project-local |
| Narration | VieNeu + user-provided audio | generated/imported narration from saved Chapter content; narration remains the master clock |
| Visual timing | source-anchor resolver + backend `NarrationTextClockMapper` | `source_anchor -> UTF-16 text range -> narration alignment -> production beat clock` |
| Remote object storage | Cloudflare R2 | authenticated reusable ACCOUNT voice-reference/custom-voice assets only |
| Desktop project storage | Electron `userData` + `project.manifest.json` | local-first project media, PROJECT voice references, backups, render work/cache and final artifacts |
| Desktop deterministic render | FFmpeg + ffprobe from Electron main | backend-assigned lease-controlled final rendering and local MP4 output |

Redis is intentionally not part of the MVP runtime. Translation/content-variant infrastructure is also intentionally absent from the current product baseline. Adding either later requires an explicit architecture/product decision.

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
  -> protected system clipboard write
```

The renderer must not become a second source of truth for Projects, Chapters, storyboard state, assets, entitlements or durable render state.

## Storage and timing status

Current storage is intentionally split by responsibility:

```text
project image/audio/video             -> project-local storage
PROJECT voice reference               -> project-local storage / manifest
ACCOUNT voice reference/custom voice  -> Cloudflare R2
final MP4                              -> Desktop project artifacts
metadata                               -> PostgreSQL
```

There is no generated-project-media R2 transport/fallback in the current runtime.

Current visual timing is source anchored. AI materialization resolves deterministic UTF-16 text ranges; backend production-timeline reads map those ranges through narration/subtitle alignment. Provisional fallback timing is review-only and does not satisfy render readiness.

## Authentication status

Desktop is guest-first. A stable installation-scoped guest identity provides ownership continuity for free workspace usage. Google remains the only end-user account sign-in provider and is required for backend-gated account/provider-consuming operations.

The guest installation secret, signed-in user session and local-execution device credential are separate security concepts. Google access/refresh tokens never enter Electron. `NX_SESSION` state and one-time Desktop OAuth handoffs are persisted in PostgreSQL; the raw handoff code is never stored.

## Persistence status

Production persistence is MyBatis + explicit PostgreSQL SQL. The final pre-release baseline is V1-V8. V1-V6 separate schema/database responsibilities, V7 contains indexes/invariants and V8 contains deterministic catalog seeds. Future migrations begin at append-only V9 only after the first production deployment.
