# NarrativeX Data Flow and Durability Model — V1.12

PostgreSQL state, not renderer memory, delivery hints or process memory, determines durable NarrativeX business/execution truth. Desktop project bytes are local-first but durable ownership/policy/job identity remains backend-owned.

## Authority matrix

| Concern | Authority | Notes |
|---|---|---|
| Guest/account identity and ownership | PostgreSQL | stable installation guest + Google-linked accounts |
| Server session | PostgreSQL via Spring Session JDBC | restart-safe server-managed session state |
| Desktop OAuth handoff | PostgreSQL | 90-second, hash-only, PKCE-bound, atomically single-use |
| Project/StoryVersion/Chapter/storyboard/continuity | PostgreSQL | ownership/versioning apply |
| GenerationJob/StageAttempt/ProviderOperation | PostgreSQL | worker claims and lifecycle truth |
| Generation status delivery | authenticated SSE + Desktop watchdog GET | best-effort transport; PostgreSQL job rows remain authoritative |
| Queue discovery | PostgreSQL polling/claim SQL | durable source; no broker or notification dependency |
| MediaPlan / production policy | PostgreSQL | worker/device executes persisted authorized state |
| Production beat media selection | PostgreSQL | explicit editor choice is part of the consolidated V1 schema |
| Narration document/set/alignment metadata | PostgreSQL | source/narration fingerprints pin inputs |
| Render subtitle snapshot | PostgreSQL render input chapter snapshot | immutable source text + alignment spans used by local SRT generation |
| Desktop project byte locations | local `project.manifest.json` | relative paths + size/SHA-256; not domain authority |
| Desktop render journal/cache | local project work storage | recovery/performance aid, not backend business authority |
| Desktop final MP4 bytes | local project `artifacts/` | backend stores metadata only |
| AI-generated remote media | Cloudflare R2 | transport/durability before Desktop materialization |
| Guest installation secret | Electron secure storage | backend stores only hash |
| Local-execution device credential | Electron protected storage | machine credential, not user session |

Redis is not required by the MVP runtime.

## Project deletion

```text
Desktop confirms deletion
  -> DELETE /api/v1/projects/{projectId}
  -> backend locks the owner-scoped Project row
  -> Project transitions to ARCHIVED with archived_at
  -> active project queries no longer return it
  -> Desktop marks the local catalog entry ORPHANED
  -> local project bytes remain available for recovery/backup
```

PostgreSQL remains authoritative for the project lifecycle. Deleting a project does not
recursively delete shared Characters or machine-local project bytes.

## Guest-first session flow

```text
Desktop start
  -> GET /api/v1/auth/me
  -> no valid session
  -> POST /api/v1/auth/desktop/guest
  -> main injects installation deviceId + secret
  -> backend verify/create stable guest mapping
  -> Spring Session JDBC persists NX_SESSION
  -> ROLE_GUEST session
```

A session may expire without losing guest ownership continuity because the installation credential can restore the same guest identity.

## Gated Google sign-in flow

```text
guest invokes account/provider-consuming action
  -> backend 403 AUTHENTICATION_REQUIRED
  -> LoginModal remains over current route
  -> main opens system-browser Google OIDC
  -> narrativex:// one-time code
  -> backend atomically consumes hashed handoff row
  -> eligible guest ownership transfer
  -> ROLE_USER session
  -> refetch current editor data
```

Google tokens never enter Electron.

## Chapter Analyze

```text
persisted Chapter
  -> lock/reload authoritative snapshot
  -> admission + reservation/policy
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> transaction commits; outbox bookkeeping is finalized
  -> worker polls/claims GenerationJob from PostgreSQL
  -> lease/heartbeat
  -> ProviderOperation where applicable
  -> validated result
  -> stale-snapshot re-check
  -> continuity/storyboard materialization
```

## Narration

```text
TTS
  -> provider/local inference
  -> validate
  -> alignment
  -> Desktop materialization before local editing/rendering

USER_PROVIDED_AUDIO
  -> native import/register
  -> one logical global clock
  -> alignment
  -> no TTS for covered scope
```

Narration alignment is the production timing authority.

## Image generation

```text
pinned authorized image work
  -> provider execution/reconciliation
  -> validate/correlate bytes
  -> stable MediaAsset + checksum + lineage
  -> remote generated-media transport where required
  -> Desktop materialize accepted/required image
  -> project.manifest.json
```

R2 may hold generated media while provider/worker execution needs a remote durable location. Final rendering never depends on a remote final-video store.

## Gemini Web Desktop generation

```text
Chapter selects GEMINI_WEB
  -> no API media job/cost estimate; Storyboard is the generation entry point
  -> Electron renderer requests typed Gemini Web capability
  -> Electron main starts/reuses visible Chrome with dedicated profile + CDP
  -> user signs in to Gemini in that Chrome window when required
  -> main applies the locked manhua series prompt wrapper around untrusted scene text
  -> fresh conversation + Images mode + one Visual Beat prompt
  -> wait for generated image and download full-size result
  -> validate supported image type/non-empty file + SHA-256
  -> create sender-bound single-use selection token
  -> backend registers LOCAL_ONLY asset metadata
  -> Electron main commits staged bytes to ProjectStorage
  -> production beat-media selection points to the new asset
```

`Gemini All` is a renderer-owned, project/chapter-keyed serial queue with resume/skip/stop controls. It is not a durable backend queue and stopping it does not necessarily cancel a generation already running in Chrome. The renderer copies prompts through the typed preload bridge to Electron main; it does not call the browser clipboard API directly.

## Native local import

```text
renderer asks to import
  -> Electron main native picker
  -> inspect/hash + short-lived selection token
  -> backend register LOCAL_ONLY stable asset identity
  -> main copy/register in ProjectStorage
  -> manifest relative path + integrity
```

An arbitrary absolute local path does not cross into durable backend domain state.

## Production timeline

```text
storyboard + narration alignment + media assets
  -> backend production timeline read
  -> persisted beat media selections
  -> renderer draft edits / Auto Edit plan
  -> atomic backend application of render overrides
  -> render submission
  -> immutable render input snapshot
```

Draft UI state must not be mistaken for durable production truth.

## Desktop final render

```text
backend admits + assigns local render
  -> device claims lease
  -> preflight runtime/disk/assets
  -> resolve IDs/checksums through project.manifest.json
  -> write atomic render journal
  -> reuse valid segment cache
  -> FFmpeg render missing segments
  -> derive subtitle cues from immutable narration snapshot
  -> write UTF-8 SRT when cues are renderable
  -> concat/mux
  -> ffprobe + SHA-256 final MP4
  -> register final-artifact metadata
  -> backend progress/completion under current lease
  -> Desktop previews/exports local MP4 directly
```

Lease loss prevents success. In-process cancellation and unfinished-journal discovery exist. Full crash/restart resume/retry behavior remains hardening work.

## Real-time generation status

```text
backend durable job update
  -> owner-scoped `/api/v1/generation-jobs/{jobId}/events` snapshot
  -> Electron main authenticated SSE bridge
  -> renderer React Query cache update
  -> terminal snapshot closes the stream
```

Desktop reconnects the stream when needed and keeps a 15-second GET watchdog while a job is active. SSE delivery is not the queue or durable status authority; a missed event is recovered from PostgreSQL through the normal job query.

## Backup/restore data flow

```text
active project workspace
  -> manifest-verified backup snapshot
  -> restore/archive-copy through Electron main
  -> preserve/rename prior active workspace when replacing
  -> verify restored manifest/files before normal use
```

Backup snapshots are local file durability tools; backend domain ownership still comes from PostgreSQL.

## Current gaps

- full stage-by-stage crash/restart recovery UX and long-form soak validation;
- adaptive narration-driven VisualScenePlanner/review;
- richer media reuse/reframe/edit lineage;
- complete arbitrary multi-part user-audio production behavior;
- production packaging/signing/update/protocol hardening;
- complete billing/actual-usage and operational/DR evidence.
