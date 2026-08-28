# NarrativeX Service and Module Boundaries — V1.11

NarrativeX uses one Spring Boot modular monolith, separately executed Python AI worker roles and one Electron Desktop editor with a strict native/UI boundary. Feature boundaries are ownership boundaries, not microservices.

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
- FFmpeg/ffprobe, render journal/cache and final-artifact open/reveal/export;
- Gemini Web Chrome/CDP automation, isolated profile/staging and lifecycle;
- Gemini Web reference-file attachment and output network capture;
- protected clipboard writes exposed through a narrow typed capability.

## Backend feature ownership

| Feature / area | Responsibility |
|---|---|
| auth/account | stable guest mapping, Google-linked account identity, server session/CSRF, Desktop one-time exchange, guest ownership transfer and account/quota reads |
| project | Project/StoryVersion ownership and lifecycle |
| storyboard | Chapter, StoryboardRevision, Scene, VisualBeat, source/review semantics |
| character | Character/ProjectCharacter/CharacterVersion/Appearance continuity, AI identity mapping and reference state |
| assets | stable MediaAsset identity, checksums, local/remote generated-media metadata and registration rules |
| generation | OperationPlan/MediaPlan, GenerationJob, StageAttempt, ProviderOperation, media planning/generation and durable orchestration |
| production timeline | production read aggregation, timing precedence/fallback and explicit beat media selection |
| local execution | device enrollment/revocation/capabilities, assignment, claim/lease/progress/terminal state |
| render | render snapshots/manifests and FinalArtifact metadata only; final bytes remain local |
| notification | durable notification state/read surfaces |
| common | small shared primitives and API envelopes only |

The backend is authoritative for ownership, authorization, entitlement/quota, execution policy, production choices, assignment and durable job/artifact state. It never persists machine-specific absolute Desktop project paths and does not proxy final MP4 bytes.

### Production timing boundary

Current backend production timeline semantics distinguish:

```text
current valid MediaPlan timing
  -> authoritative planned timing

incomplete/unplanned beat timing
  -> generic fallback geometry where representable
  -> NOT proof of exact narration alignment
```

Exact storyboard `text_start/text_end` and source-to-audio `audio_start_ms/audio_end_ms` reconciliation remain TARGET/PARTIAL at the audited checkpoint. The backend must not present fallback geometry as exact `ALIGNED` timing.

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

Workers own asynchronous provider/media execution mechanics:

- PostgreSQL job/stage claim/lease/heartbeat;
- provider submit/status/reconciliation;
- structured Chapter analysis and materialization;
- Character profile/appearance and beat-specific Character participation materialization;
- VieNeu narration execution and narration alignment persistence;
- user-audio validation/alignment foundations;
- Vertex/API image generation;
- generated-media validation and R2 transport where required;
- bounded retry/reconciliation/runtime-file handling.

The current worker supervisor roles are `analysis`, `narration`, `media-validation`, and `image-generation`. Workers do not execute final project renders or own Desktop paths/native capabilities, user authorization, entitlement policy or Flyway schema ownership.

Gemini Web execution remains in Electron main, not in the Python worker.

## MediaPlan / production policy boundary

Backend policy is authoritative for production/motion strategy, workload/cost authorization and immutable render input. Desktop devices and Python workers execute pinned policy; fallback/escalation is allowed only when explicitly authorized.

Persisted beat media selection is production state, not a renderer-only decoration.

## Narration boundary

`NarrationStrategy.TTS` and `NarrationStrategy.USER_PROVIDED_AUDIO` are domain policy. Audio processing/alignment mechanics may run in worker/local components, but source identity, strategy, authorization, fingerprints and durable metadata remain backend/domain concerns.

Compatible real narration alignment is the intended visual master clock. Narration alignment persistence and VisualBeat timing reconciliation are separate responsibilities; the former is implemented foundation, the latter remains active work.

## Project media storage boundary

```text
AI-generated image/narration transport -> Cloudflare R2 when remote durability is required
project images/audio/video              -> local project workspace
render work/cache                       -> local project workspace/work
backups                                 -> Desktop-managed local storage
final MP4                               -> local project workspace/artifacts
business/job/artifact metadata          -> PostgreSQL
```

Electron main owns local resolution/validation. Backend metadata uses stable IDs/checksums and project-relative/opaque artifact keys; final playback/export reads the local artifact directly.

ADR-0012 governs Desktop local-first project bytes; ADR-0003 remains historical/current evidence only for remote generated-media/provider transport within its non-superseded scope.

## Gemini Web boundary

`GEMINI_WEB` is a Desktop execution path for manual/per-beat generation through a visible Chrome window.

Electron main:

- starts/reuses a dedicated Chrome profile;
- drives `https://gemini.google.com/app` through local CDP;
- waits for user authentication when required;
- attaches beat-scoped locked Character reference files in deterministic order;
- applies the main-owned series style/reference prompt wrapper while treating scene text as untrusted data;
- captures pre-submit DOM/network baseline;
- uses fresh `image/*` CDP network responses plus `Network.getResponseBody` as the primary byte path;
- treats the visible Gemini Download control as fallback only;
- validates bytes/checksum and stages them behind a sender-bound single-use selection token.

The renderer receives typed metadata/capabilities and never receives arbitrary source filesystem paths. This path does not pass Gemini credentials through Electron, does not use a Python Gemini Web provider, and does not replace backend-authorized Vertex/API image jobs.

## Persistence boundary

Application/domain repository ports remain persistence-neutral. Production infrastructure uses MyBatis + explicit PostgreSQL SQL. Flyway owns schema evolution; V1-V8 are the clean pre-release baseline. After first production deployment, future schema changes are append-only from V9+.

## Dependency direction

```text
API adapters -> application use cases -> domain
application -> outbound ports
infrastructure -> application/domain contracts
renderer -> backend contracts + preload capabilities
preload -> narrow main-process IPC
Electron main -> native/local adapters + backend session/device contracts
worker -> persisted execution contracts + provider/generated-media adapters
```

Provider/vendor/storage branches stay in adapters rather than domain policy.

## Documentation boundary

- current AS-IS summaries live under `documentation/`;
- ADR bodies are historical decision evidence and supersession is indexed in `documentation/decisions/README.md`;
- implementation plans under `docs/superpowers/plans/` are non-authoritative until implemented and verified;
- code, migrations and tests win when current docs conflict with executable behavior.
