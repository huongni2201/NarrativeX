# NarrativeX Service and Module Boundaries

NarrativeX is one deployable Spring Boot application with explicit bounded features plus one separately deployed Python worker. These are ownership boundaries inside a modular monolith, not a promise that each feature is already fully implemented.

## Spring features

| Feature | Owns | Must not own |
|---|---|---|
| `auth` | Google OIDC identity, server-side HttpOnly session, roles and current-user context | Provider keys, generation logic, client-side auth state as authority |
| `project` | Project lifecycle/ownership and StoryVersion creation/versioning boundary | Provider SDKs, media encoding, storyboard scene state |
| `character` | reusable Character identity, ProjectCharacter assignment, CharacterVersion, appearance/outfit rules | GPU inference and provider SDK branches |
| `storyboard` | Chapter and Scene aggregates, VisualBeat child entities, storyboard ordering/edit/lifecycle rules | File encoding, object-storage plumbing, provider calls |
| `generation` | GenerationJob and OperationPlan aggregates, StageAttempt/ProviderOperation execution state | Vendor-specific SDK branches in domain |
| `asset` | target ownership for Asset metadata, checksums, signed URL policy and lifecycle | Binary bytes in PostgreSQL or provider-generation policy |
| `render` | target ownership for RenderVersion, render manifest and FinalArtifact readiness | FFmpeg in request threads |
| `shorts` | target ownership for ShortCandidate, ShortClip and vertical-plan policy | Social-network SDKs or provider secrets |
| `billing` / `cost` | target ownership for usage, estimates, reservation and resource metering | Pricing constants embedded in UI/provider adapters |
| `entitlement` | target ownership for plan entitlement, watermark, export and concurrency capability | Client-side flags that bypass server policy |
| `provider` | capability registry, routing, health, limiter/circuit policy and adapter contracts | Vendor credentials in domain entities |
| `notification` | Notification, preferences, transactional outbox and delivery state | Email vendor coupling inside domain entities |
| `safety` | moderation decisions, policy versioning, rights/consent gates and identity-review decisions | Treating provider safety signals as canonical business state |
| `common` | small cross-cutting primitives, error contracts and generic API helpers | A catch-all business module or “god utility” |

Only `auth`, `project`, `character`, `storyboard`, `generation`, `health` and `common` are current concrete backend feature slices in the repository. The other rows document target ownership so new code does not drift into the wrong feature while those slices are introduced.

## Storyboard ownership

Storyboard is a feature/business capability; feature boundaries and aggregate boundaries are not the same concept.

```text
project feature
  Project aggregate
    StoryVersion entity/reference
        |
        v
storyboard feature
  Chapter aggregate
        |
        | chapterId
        v
  Scene aggregate
        |
        v
  VisualBeat child entity
```

- `Chapter` owns chapter identity, StoryVersion reference, title and order behavior.
- `Scene` is an independent aggregate because edit/generation work is scene-granular and can occur concurrently.
- `VisualBeat` remains a child entity for scene-level generation semantics.
- A relational FK does not force two records into the same DDD aggregate.
- Storyboard read models may compose multiple aggregates/features without becoming transactional aggregate roots.

See `ADR-0007-storyboard-aggregate-boundaries.md` for the decision rationale.

## Worker boundary

The Python worker owns execution, not authority:

- claims a persisted stage through a backend contract;
- calls planning/image/video/TTS adapters or deterministic media tooling;
- performs schema validation, image processing, identity QA and FFmpeg work;
- uploads temporary/immutable objects through the storage contract;
- reports progress, provider status, output evidence and measured resource usage.

The worker must not authorize a user, decide entitlement, mutate arbitrary project/storyboard ownership, write canonical billing history without backend validation, or invent a new job from model output.

## Port contracts

Domain code depends on capability-oriented contracts; SDKs, HTTP details and secret access stay in infrastructure/worker adapters.

```text
LlmProvider
  capabilities() / estimate() / plan() / structuredResult()

ImageGenerationProvider
  getCapabilities() / estimate() / submit() / getStatus()
  reconcile() / cancelWhenSupported() / fetchAndValidateOutput()

VideoGenerationProvider
  getCapabilities() / estimate() / submitMotion() / getStatus()
  reconcile() / cancelWhenSupported() / fetchAndValidateOutput()

ObjectStorage / StoragePort
  createUploadTarget() / verify() / promoteImmutable()
  signedReadUrl() / lifecycleAction()
```

## Allowed dependency direction

```text
web/API adapters -> application use cases -> domain
application use cases -> outbound ports
infrastructure adapters -> application/domain contracts
worker -> backend job contract + provider/storage adapters
```

Rules:

- Domain does not import provider SDKs, FFmpeg, Redis clients, MinIO/S3 clients or Spring/JPA.
- Aggregates own business invariants and state transitions; application services orchestrate multiple aggregates and technical ports.
- Application use cases return application/domain results and must not return `ApiResponse`, controller response DTOs, servlet types or other HTTP transport wrappers. Controllers map use-case results to the public API response contract.
- API request/response DTOs belong to the API adapter boundary. Shared generic HTTP helpers may live in `feature/common`, but business application packages must not depend on them.
- `generation` coordinates execution; it does not own Scene business state.
- `asset` owns storage metadata/abstraction when implemented so each feature does not invent bucket/key rules.
- Features communicate through explicit application contracts, stable IDs or events; do not reach into another feature's repositories.
- `feature/common` stays intentionally small. If a type contains business policy, it belongs to its owning feature.
- A new microservice is justified only by measured bottleneck, independent deployment/ownership, or a hard runtime/security boundary. The Python worker already satisfies the main runtime boundary.

## Architecture enforcement

The backend enforces package/dependency rules under `src/test/java/com/narrativex/backend/architecture/`:

- API may call application use cases, but not infrastructure repositories directly;
- application packages do not depend on another feature's domain implementation;
- application packages do not depend on API response/request types or generic HTTP response wrappers;
- cross-feature application calls use explicit inbound ports where needed;
- domain packages do not import web, Redis, storage, provider or worker runtime packages;
- `feature/common` does not import business features;
- aggregate roots live in `domain/aggregate`; child domain entities live in `domain/entity`.

`StoryboardAggregateBoundaryTest` additionally verifies that `Chapter` and `Scene` remain independent aggregate roots and `VisualBeat` remains a child entity.

## DDD package structure

```text
feature/<name>.api
  -> feature/<name>.application.command / query / usecase / port.in
      -> feature/<name>.domain
      -> feature/<name>.application.port.out
feature/<name>.infrastructure
  -> feature/<name>.application.port.out
  -> feature/<name>.domain
```

- `domain/aggregate` contains aggregate roots and their invariant-enforcing behavior.
- `domain/entity` contains non-root entities owned by an aggregate boundary.
- `domain/enums` and `domain/exception` hold feature-owned domain codes/errors.
- `application.usecase` owns orchestration and transaction boundaries.
- `application.port.out` owns persistence/external abstractions and must not expose Spring Data types.
- `infrastructure.persistence` owns JPA entities, Spring Data repositories and mappers.
- Cross-feature references use stable IDs or explicit application ports.

## External system ownership

| System | NarrativeX owns | System owns |
|---|---|---|
| Google OIDC | local identity link, session and authorization | authentication at Google |
| AI/media providers | request snapshot, operation state, policy/cost attribution and reconciliation | provider execution |
| PostgreSQL | canonical application state and migrations | durable database mechanics |
| Redis | queue/cache/progress delivery integration | in-memory delivery mechanics; never canonical business state |
| MinIO/S3 | storage keys, metadata, validation, lifecycle and signed URLs | durable object mechanics/replication |
| Email/web-push | notification intent and retry state | channel delivery outcome |
