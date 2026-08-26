# NarrativeX Service and Module Boundaries — V1.11

NarrativeX uses one Spring Boot modular monolith, separately executed Python worker roles and one Electron Desktop editor with a strict native/UI boundary. Feature boundaries are ownership boundaries, not microservices.

## Desktop boundary

### Renderer

Owns editor UX only:

- routes/project-scoped screens;
- React Query backend state and local editor draft state;
- timeline/preview/inspector interactions;
- typed backend contracts;
- explicit preload capability calls.

It does not own session cookies, guest/device secrets, arbitrary filesystem/process access, durable policy or FFmpeg execution.

### Preload

Exposes allow-listed typed capabilities. It must not expose general Node.js primitives.

### Main

Owns machine/native capabilities:

- stable installation guest credential;
- backend session transport;
- system-browser OAuth and `narrativex://` callback handling;
- native file/folder selection and file inspection/hash;
- ProjectStorage/ProjectCatalog and local manifest;
- backup/restore/archive-copy, storage verification and cleanup;
- protected local device identity;
- heartbeat/render claim/lease/progress/completion/failure;
- FFmpeg/ffprobe, render journal/cache and artifact open/reveal.

## Backend feature ownership

| Feature / area | Responsibility |
|---|---|
| auth/account | stable guest mapping, Google-linked account identity, server session/CSRF, Desktop one-time exchange, guest ownership transfer and account/quota reads |
| project | Project/StoryVersion ownership and lifecycle |
| storyboard | Chapter, Scene, VisualBeat, source/review semantics |
| character | Character/ProjectCharacter/CharacterVersion/Appearance continuity and reference state |
| assets | stable MediaAsset identity, checksums, local/cloud materialization metadata and registration rules |
| generation | OperationPlan/MediaPlan, GenerationJob, StageAttempt, ProviderOperation, media planning/generation and durable orchestration |
| production timeline | production read aggregation, aligned beat timing and explicit beat media selection |
| local execution | device enrollment/revocation/capabilities, assignment, claim/lease/progress/terminal state |
| render | render snapshots/manifests, FinalArtifact metadata and provider-neutral artifact semantics |
| notification | durable notification state/read surfaces |
| common | small shared primitives and API envelopes only |

The backend is authoritative for ownership, authorization, entitlement/quota, execution policy, production choices, assignment and durable job state. It never persists machine-specific absolute Desktop project paths.

## Guest/account authorization boundary

Guest identity and account sign-in are different concepts:

```text
installation guest
  -> stable internal owner/session identity
  -> explicit free endpoint allowlists

Google account
  -> only end-user sign-in provider
  -> ROLE_USER account/provider-consuming operations
```

A gated guest action returns `AUTHENTICATION_REQUIRED`; Desktop opens the LoginModal and completes Google OIDC without discarding the active project/editor route. Backend authorization remains the enforcement point.

## Python worker boundary

Workers own asynchronous provider/server execution mechanics:

- provider claim/submit/status/reconciliation;
- structured analysis materialization;
- Google TTS/VieNeu execution foundations;
- user-audio validation/alignment roles;
- Vertex image generation;
- retained R2 remote materialization;
- retained cloud/server FFmpeg render and Google Drive final-video path;
- bounded retry/reconciliation/runtime-file handling.

Workers do not own Desktop paths/native capabilities, user authorization, entitlement policy or Flyway schema ownership.

## MediaPlan / production policy boundary

Backend policy is authoritative for production/motion strategy, workload/cost authorization and immutable render input. Desktop devices and Python workers execute the pinned policy; fallback/escalation is allowed only when explicitly authorized.

Persisted beat media selection is production state, not a renderer-only decoration.

## Narration boundary

`NarrationStrategy.TTS` and `NarrationStrategy.USER_PROVIDED_AUDIO` are domain policy. Audio processing/alignment mechanics may run in worker/local components, but source identity, strategy, authorization, fingerprints and durable metadata remain backend/domain concerns.

Narration timing is the master clock.

## Project media storage boundary

### Desktop primary

```text
project images/audio/video  -> local project workspace
render work/cache           -> local project workspace/work
backups                     -> Desktop-managed local storage
final local MP4             -> local project workspace/artifacts
```

Electron main owns local resolution/validation. Backend metadata uses stable IDs/checksums and opaque relative artifact keys.

### Retained server/cloud path

```text
pipeline media              -> Cloudflare R2
cloud final MP4             -> Google Drive
worker scratch              -> ephemeral filesystem
```

ADR-0012 governs Desktop local-first project bytes; ADR-0003 governs retained server/cloud storage.

## Persistence boundary

Application/domain repository ports remain persistence-neutral. Production infrastructure uses MyBatis + explicit PostgreSQL SQL. Flyway owns schema evolution; V1-V3 are frozen and V4+ additive.

## Dependency direction

```text
API adapters -> application use cases -> domain
application -> outbound ports
infrastructure -> application/domain contracts
renderer -> backend contracts + preload capabilities
preload -> narrow main-process IPC
Electron main -> native/local adapters + backend session/device contracts
worker -> persisted execution contracts + provider/cloud adapters
```

Provider/vendor/storage branches stay in adapters rather than domain policy.
