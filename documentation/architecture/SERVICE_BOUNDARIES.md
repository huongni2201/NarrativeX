# NarrativeX Service and Module Boundaries — V1.11

NarrativeX remains one deployable Spring Boot modular monolith plus one separately deployed Python AI/media worker. Feature boundaries are ownership boundaries, not microservices.

## Backend ownership

| Feature / area | V1.11 responsibility |
|---|---|
| auth/account | identity, session/CSRF, account/quota reads |
| project | Project/StoryVersion ownership and project lifecycle |
| storyboard | Chapter, Scene, VisualBeat and review/source semantics |
| character | Character/ProjectCharacter/CharacterVersion continuity/reference state |
| generation | OperationPlan/MediaPlan, GenerationJob, StageAttempt, ProviderOperation, narration planning and durable orchestration |
| notification | durable notification state/read surfaces |
| common | small shared primitives only; not a policy dumping ground |

Asset/render capabilities may become concrete feature slices as their production workflows land, but current ownership still follows explicit application ports and generation/media contracts.

## Worker boundary

The Python worker owns execution mechanics:

- durable claim/lease/heartbeat;
- provider calls and reconciliation;
- structured analysis materialization;
- TTS and narration media execution;
- user-provided audio part/timeline processing and alignment execution boundary;
- future image generation and FFmpeg render execution;
- R2 upload/download through provider-neutral storage ports;
- validation of external/provider media results.

The worker does **not** own browser authorization, entitlement/quota policy, MediaPlan authorization, Flyway migrations or public HTTP APIs.

## MediaPlan policy boundary

The backend is authoritative for `ProductionMode` and resolved `MotionStrategy`. Workers receive/execute a pinned immutable plan revision. Fallback is allowed only inside persisted authorization.

## Narration boundary

`NarrationStrategy.TTS` and `NarrationStrategy.USER_PROVIDED_AUDIO` are generation-domain policy vocabulary. Audio processing/alignment mechanics remain worker-owned, while selection, fingerprints, authorization and durable metadata are backend/domain concerns.

## Persistence boundary

Application/domain repository ports remain persistence-neutral. Infrastructure converges on MyBatis + explicit SQL + PostgreSQL. ProviderOperation, Chapter and Project are already MyBatis-backed; remaining JPA/JDBC adapters are incremental migration surfaces.

## Dependency direction

```text
API adapters -> application use cases -> domain
application -> outbound ports
infrastructure -> application/domain contracts
worker -> persisted execution/media contracts + provider/storage adapters
```

Provider/vendor/storage SDK branches stay in adapters, not domain code.
