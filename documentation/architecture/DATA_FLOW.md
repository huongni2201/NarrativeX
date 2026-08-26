# NarrativeX Data Flow and Durability Model — V1.11

PostgreSQL state, not renderer memory, Redis messages or process memory, determines durable NarrativeX business/execution truth. Desktop project bytes are local-first but durable ownership/policy/job identity remains backend-owned.

## Authority matrix

| Concern | Authority | Notes |
|---|---|---|
| Guest/account identity and ownership | PostgreSQL | stable installation guest + Google-linked accounts |
| Server session | Redis via Spring Session | availability/session state, not domain truth |
| Project/StoryVersion/Chapter/storyboard/continuity | PostgreSQL | ownership/versioning apply |
| GenerationJob/StageAttempt/ProviderOperation | PostgreSQL | process memory may carry hints only |
| MediaPlan / production policy | PostgreSQL | worker/device executes persisted authorized state |
| Production beat media selection | PostgreSQL | explicit editor choice persists through V5 |
| Narration document/set/alignment metadata | PostgreSQL | source/narration fingerprints pin inputs |
| Desktop project byte locations | local `project.manifest.json` | relative paths + size/SHA-256; not domain authority |
| Desktop render journal/cache | local project work storage | recovery/performance aid, not backend business authority |
| Desktop final MP4 bytes | local project `artifacts/` | backend stores opaque local artifact identity/metadata |
| Retained cloud pipeline bytes | Cloudflare R2 | server/provider path |
| Retained cloud final MP4 | Google Drive | cloud-render fallback path |
| Guest installation secret | Electron secure storage | backend stores only hash |
| Local-execution device credential | Electron protected storage | machine credential, not user session |

## Guest-first session flow

```text
Desktop start
  -> GET /api/v1/auth/me
  -> no valid session
  -> POST /api/v1/auth/desktop/guest
  -> main injects installation deviceId + secret
  -> backend verify/create stable guest mapping
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
  -> backend exchange
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
  -> worker claim/lease/heartbeat
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
  -> Desktop materialization when used locally

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
  -> Desktop materialize accepted/required image
  -> project.manifest.json
```

Retained server/cloud flows may persist remote media in R2 where remote durability is intentionally required.

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

## Desktop local render

```text
backend admits + assigns LOCAL_DEVICE render
  -> device claims lease
  -> preflight runtime/disk/assets
  -> resolve IDs/checksums through project.manifest.json
  -> write atomic render journal
  -> reuse valid segment cache
  -> FFmpeg render missing segments
  -> concat/mux
  -> ffprobe + SHA-256 final MP4
  -> local artifact registration
  -> backend progress/completion under current lease
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

## Retained cloud render

```text
cloud-authorized render
  -> R2 inputs
  -> worker FFmpeg/ffprobe
  -> Google Drive final upload
  -> FinalArtifact provider metadata
  -> terminal backend state
```

This path is fallback/server behavior and must not redefine Desktop local storage.

## Current gaps

- full stage-by-stage crash/restart recovery UX and long-form soak validation;
- adaptive narration-driven VisualScenePlanner/review;
- richer media reuse/reframe/edit lineage;
- complete arbitrary multi-part user-audio production behavior;
- production packaging/signing/update/protocol hardening;
- complete billing/actual-usage and operational/DR evidence.
