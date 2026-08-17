# NarrativeX Service and Module Boundaries

NarrativeX is one deployable Spring Boot application with explicit bounded modules plus one separately deployed Python worker. These are ownership boundaries inside a modular monolith, not a promise that each row or module is already implemented in the current scaffold.

## Spring modules

| Module | Owns | Must not own |
|---|---|---|
| `auth` | Google OIDC identity, server-side HttpOnly session, roles and current-user context | Provider keys, generation logic, client-side auth state as authority |
| `project` | Project lifecycle and ownership | Provider SDKs, media encoding |
| `story` | StoryVersion, rights attestation, chapter parsing requests | Direct LLM calls or ComfyUI calls |
| `character` | Character, CharacterVersion, Bible, OutfitVersion, references and consent metadata | GPU inference and raw embedding logs |
| `scene` | Scene, Shot, VisualBeat, storyboard and optimistic edits | File encoding and object-storage plumbing |
| `generation` | GenerationJob, StageAttempt, WorkerLease, ProviderOperation state machines | Vendor-specific SDK branches |
| `asset` | Asset metadata, checksums, signed URL policy and lifecycle | Binary bytes in PostgreSQL or direct provider calls |
| `render` | RenderVersion, render manifest, FinalArtifact readiness | FFmpeg in request threads |
| `shorts` | ShortCandidate, ShortClip, vertical plan and short policy | Social-network SDKs or provider secrets |
| `billing` / `cost` | UsageWindow, OperationPlan, CostEstimate, CostReservation, UsageLedger and resource metering | Pricing constants embedded in UI/provider adapters |
| `entitlement` | PlanEntitlement, watermark, quality, export and concurrency capability | Client-side flags that bypass server policy |
| `provider` | Capability registry, routing, health, rate/circuit policy and ports | Vendor credentials in domain entities |
| `notification` | Notification, preferences, transactional outbox and delivery state | Email vendor coupling inside domain entities |
| `safety` | Moderation decisions, policy versioning, rights/consent gates, identity-review decisions | Treating provider safety signals as canonical business state |
| `character-library` | User-owned immutable CharacterTemplate versions and project import snapshots | Auto-updating old projects from a mutable library |
| `shared` | Small cross-cutting primitives, IDs, clocks, error contracts | A catch-all business module or “god utility” |

## Worker boundary

The Python worker owns execution, not authority:

- claims a persisted stage through a backend contract;
- calls Vertex AI Gemini, image/video/TTS adapters or deterministic media tooling;
- performs schema validation, image processing, identity QA and FFmpeg work;
- uploads temporary/immutable objects through the storage contract;
- reports progress, provider status, output evidence and measured resource usage.

The worker must not authorize a user, decide entitlement, mutate arbitrary project ownership, write canonical billing history without backend validation, or invent a new job from LLM output.

## Port contracts

Domain code depends on capability-oriented ports. Adapters contain SDKs, HTTP details and secret access.

```text
LlmProvider
  capabilities() / estimate() / plan() / structuredResult()

ImageGenerationProvider
  getCapabilities() / estimate() / submit() / getStatus()
  reconcile() / cancelWhenSupported() / fetchAndValidateOutput()

VideoGenerationProvider
  getCapabilities() / estimate() / submitMotion() / getStatus()
  reconcile() / cancelWhenSupported() / fetchAndValidateOutput()

StoragePort
  createUploadTarget() / putTemporary() / verify() / promoteImmutable()
  signedReadUrl() / lifecycleAction()

NotificationPort
  enqueueFromOutbox() / deliverInApp() / deliverEmailOrPush()
```

`VertexGeminiProvider` implements planning/intelligence. `VertexImageProvider`, `ComfyUIProvider`, `VertexVeoProvider`, `KlingProvider` and future adapters implement separate media ports. Veo must not leak vendor-specific concepts into the domain just because it is also a Vertex capability.

## Allowed dependency direction

```text
web/API adapters -> application use cases -> domain modules
domain modules -> ports and small shared primitives
infrastructure adapters -> domain/application ports
worker -> backend job contract + provider/storage adapters
```

Rules:

- A domain module does not import provider SDKs, FFmpeg, Redis clients or MinIO/S3 clients.
- `generation` coordinates through interfaces; provider implementations live in infrastructure/worker adapters.
- `asset` owns storage abstraction so callers cannot each invent bucket/key rules.
- Modules communicate with explicit application commands/events; do not reach into another module's repositories.
- `shared` is intentionally small. If a type contains business policy, it belongs to its owning module.
- A new microservice is justified only by measured bottleneck, independent deployment/ownership, or a hard runtime/security boundary. The Python worker already meets the runtime boundary.

## W1-D2 enforcement

The current backend enforces these rules with automated package/dependency tests under `src/test/java/com/narrativex/backend/architecture/`:

- `module.api` may call application use cases, but not repositories;
- application packages do not import HTTP API DTOs;
- a module may not reach another module's repository;
- domain packages do not import web, Redis, storage, provider, or worker runtime packages;
- `shared` does not import business modules;
- REST controllers live in `module.api` packages.

Cross-module project lookup is intentionally exposed as the small `project.application.port.in.ProjectAccess` contract. This preserves PostgreSQL/project ownership in the project module without introducing an event bus or repository registry. The shared HTTP boundary uses RFC 9457 `ProblemDetail` and a request correlation ID; security enforcement remains a W1-D5 concern.

## DDD package structure

The active `project`, `generation` and `storyboard` slices now use the following dependency direction:

```text
module.api
  -> module.application.command / usecase / port.in
      -> module.domain.model
      -> module.application.port.out
module.infrastructure.persistence
  -> module.application.port.out
  -> module.domain.model
```

- `domain.model` contains framework-free entities, value-like enums and aggregate behavior.
- `application.command` contains input contracts owned by use cases; HTTP request records remain in `api`.
- `application.usecase` owns orchestration and transaction boundaries.
- `application.port.out` owns persistence abstractions; it does not expose Spring Data types.
- `infrastructure.persistence` owns JPA entities, Spring Data repositories and domain/persistence mappers.
- Cross-module references use stable IDs or explicit application ports. Generation never maps a JPA relationship to the project module.

## External system ownership

| System | NarrativeX owns | System owns |
|---|---|---|
| Google OIDC | local user, external identity link, session and authorization | identity authentication at Google |
| Vertex AI / image / video / TTS | request snapshot, operation state, safety mapping, usage attribution and reconciliation | provider execution and provider-side operation state |
| PostgreSQL | all canonical application state and migrations | durable database mechanics |
| Redis | queue/cache/progress integration | in-memory delivery mechanics; never canonical state |
| MinIO/S3 | storage keys, metadata, validation, lifecycle and signed URLs | durable object mechanics/replication |
| Email/web-push | notification intent and retry state | channel delivery outcome |
