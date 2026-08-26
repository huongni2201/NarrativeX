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
| Queue discovery | PostgreSQL polling/claim SQL | durable source; no broker or notification dependency |
| MediaPlan / production policy | PostgreSQL | worker/device executes persisted authorized state |
| Production beat media selection | PostgreSQL | explicit editor choice is part of the consolidated V1 schema |
| Narration document/set/alignment metadata | PostgreSQL | source/narration fingerprints pin inputs |
| Desktop project byte locations | local `project.manifest.json` | relative paths + size/SHA-256; not domain authority |
| Desktop render journal/cache | local project work storage | recovery/performance aid, not backend business authority |
| Desktop final MP4 bytes | local project `artifacts/` | backend stores metadata only |
| AI-generated remote media | Cloudflare R2 | transport/durability before Desktop materialization |
| Guest installation secret | Electron secure storage | backend stores only hash |
| Local-execution device credential | Electron protected storage | machine credential, not user session |

Redis is not required by the MVP runtime.

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
  -> renderer draft edits where supported
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
  -> concat/mux
  -> ffprobe + SHA-256 final MP4
  -> register final-artifact metadata
  -> backend progress/completion under current lease
  -> Desktop previews/exports local MP4 directly
```

Lease loss prevents success. In-process cancellation and unfinished-journal discovery exist. Full crash/restart resume/retry behavior remains hardening work.

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
