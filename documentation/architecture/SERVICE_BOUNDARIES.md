# NarrativeX Service and Module Boundaries — V1.11

NarrativeX uses one Spring Boot modular monolith, separately executed Python worker roles, and an Electron Desktop client with a strict native/UI boundary. Feature boundaries are ownership boundaries, not microservices.

## Client boundary

### Electron renderer

Owns editor UX only:

- routes and project-scoped screens;
- React Query/Zustand state;
- timeline/preview/inspector interaction;
- backend application contracts;
- narrow preload capability calls.

It does not own arbitrary filesystem/process access, durable policy or local render mechanics.

### Electron preload

Exposes only allow-listed typed capabilities. It must not expose general Node.js primitives.

### Electron main

Owns native/machine capabilities:

- system-browser OAuth start and `narrativex://` callback handling;
- native file/folder selection;
- local project workspace and `project.manifest.json`;
- protected local device identity;
- heartbeat/render claim/lease/progress/completion/failure;
- FFmpeg/ffprobe execution and active-render cancellation;
- local artifact reveal/open.

## Backend ownership

| Feature / area | Responsibility |
|---|---|
| auth/account | Google-linked identity, server session/CSRF, Desktop one-time handoff exchange, account/quota reads |
| project | Project/StoryVersion ownership and lifecycle |
| storyboard | Chapter, Scene, VisualBeat and review/source semantics |
| character | Character/ProjectCharacter/CharacterVersion continuity/reference state |
| generation | OperationPlan/MediaPlan, GenerationJob, StageAttempt, ProviderOperation, narration planning and durable orchestration |
| device/local execution | device enrollment/revocation/capabilities, assignment, claim/lease/progress/terminal state |
| render | render-domain contracts, FinalArtifact metadata and provider-neutral artifact semantics |
| notification | durable notification state/read surfaces |
| common | small shared primitives only |

The backend is authoritative for ownership, entitlement/quota, execution policy, assignment and durable job state. It never persists machine-specific absolute Desktop project paths.

## Python worker boundary

Workers own asynchronous provider/cloud execution mechanics:

- durable provider claim/lease/heartbeat where applicable;
- provider calls and reconciliation;
- structured analysis materialization;
- Google TTS/VieNeu execution foundations;
- user-audio validation/alignment foundations;
- Vertex image generation;
- retained R2 cloud materialization;
- retained cloud/server FFmpeg render and Google Drive final-video path.

The worker does not own Desktop native paths/capabilities, user-facing authorization, entitlement policy or Flyway schema ownership.

## MediaPlan policy boundary

The backend is authoritative for ProductionMode/MotionStrategy and authorized workload. Desktop local devices and Python workers execute the pinned policy. Fallback/escalation is allowed only when explicitly authorized.

## Narration boundary

`NarrationStrategy.TTS` and `NarrationStrategy.USER_PROVIDED_AUDIO` are domain policy. Audio processing/alignment mechanics may run in worker/local execution components, but source identity, strategy, authorization, fingerprints and durable metadata remain backend/domain concerns.

Desktop local render inputs should resolve narration by stable asset identity/checksum from the local project manifest. Cloud narration may remain a compatibility source while local materialization migration is incomplete.

## Project media storage boundary

### Desktop primary

```text
project images/audio/video  -> local project workspace
render work                 -> local project workspace/work
final local MP4             -> local project workspace/artifacts
```

Electron main owns resolution/validation. Backend metadata uses stable IDs, checksums and opaque project-relative artifact keys.

### Cloud/legacy fallback

```text
pipeline media              -> Cloudflare R2
cloud final MP4             -> Google Drive
worker scratch              -> ephemeral filesystem
```

ADR-0012 governs Desktop local-first project bytes; ADR-0003 governs retained cloud/worker storage.

## Authentication credential boundary

User authentication and local device authorization are distinct:

- Desktop user auth: Google OIDC system browser → one-time handoff → server-managed NarrativeX session.
- Device auth: protected machine credential used only for device heartbeat/render APIs.

Google tokens do not enter Electron. Device tokens are not user session tokens.

## Persistence boundary

Application/domain repository ports remain persistence-neutral. Production infrastructure uses MyBatis + explicit PostgreSQL SQL. JPA and direct `JdbcTemplate` are not parallel production persistence paths.

## Dependency direction

```text
API adapters -> application use cases -> domain
application -> outbound ports
infrastructure -> application/domain contracts
renderer -> backend contracts + preload capabilities
preload -> narrow main-process IPC
Electron main -> local/native adapters + backend device contracts
worker -> persisted execution contracts + provider/cloud adapters
```

Provider/vendor/storage branches stay in adapters rather than domain policy.
