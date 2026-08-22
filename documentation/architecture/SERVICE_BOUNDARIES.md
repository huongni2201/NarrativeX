# NarrativeX Service and Module Boundaries — V1.11

NarrativeX remains one Spring Boot modular monolith plus separately deployed Python worker roles. Feature boundaries are ownership boundaries, not microservices.

## Backend ownership

| Feature / area | V1.11 responsibility |
|---|---|
| auth/account | identity, session/CSRF, account/quota reads |
| project | Project/StoryVersion ownership, dashboard/favorite reads and project lifecycle |
| storyboard | Chapter, Scene, VisualBeat and review/source semantics |
| character | Character/ProjectCharacter/CharacterVersion continuity/reference state and project-scoped Character read models |
| generation | OperationPlan/MediaPlan, GenerationJob, StageAttempt, ProviderOperation, narration planning and durable orchestration |
| render | FinalArtifact read metadata and render-domain contracts |
| notification | durable notification state/read surfaces |
| common | small shared primitives only; not a policy dumping ground |

## Worker boundary

Python worker roles own execution mechanics:

- durable claim/lease/heartbeat;
- provider calls and reconciliation;
- structured analysis materialization;
- Google TTS/local VieNeu narration execution;
- user-provided audio timeline/alignment execution foundations;
- Vertex image generation and R2 image materialization;
- R2 upload/download for source/generated/reusable pipeline media;
- deterministic FFmpeg IMAGE_MOTION chapter rendering;
- ffprobe/final-video validation;
- Google Drive resumable final-MP4 upload through the final-video storage adapter.

The worker does **not** own browser authorization, entitlement/quota admission policy, MediaPlan authorization, Flyway migrations or public HTTP APIs.

## MediaPlan policy boundary

The backend is authoritative for `ProductionMode` and resolved `MotionStrategy`. Workers receive/execute a pinned immutable plan revision. Fallback is allowed only inside persisted authorization.

## Narration boundary

`NarrationStrategy.TTS` and `NarrationStrategy.USER_PROVIDED_AUDIO` are generation-domain policy vocabulary. Audio processing/alignment mechanics remain worker-owned, while selection, fingerprints, authorization and durable metadata are backend/domain concerns.

The current render worker can consume generated narration matching the pinned Chapter source identity. It does not yet slice/stitch aligned multi-part uploaded narration into chapter-local render input.

## Pipeline media storage boundary

```text
Generated images / narration / accepted uploaded audio / reusable media
  -> Cloudflare R2
```

R2 credentials and object-key behavior remain infrastructure concerns. Local paths are scratch only.

## Final video storage boundary

Render/domain policy must not depend on Google Drive-specific identifiers.

```text
render worker
  -> final-video storage abstraction
  -> GoogleDriveFinalVideoStorage
```

The current adapter owns Drive OAuth/API calls, resumable upload, render-fingerprint lookup, remote file ID/size verification and Drive-specific identifiers. PostgreSQL stores provider-aware FinalArtifact metadata such as `storageProvider`, external file ID, checksum, size and video metadata.

The adapter can resume upload within one attempt and can reuse an already-uploaded matching Drive file by render fingerprint. Because the rendered file currently lives in an ephemeral job workspace, cross-attempt upload-only retry without rerender remains a target hardening item.

## Character read boundary

Project Character list/detail APIs authorize project ownership before returning project-scoped Character data. Their MyBatis read projections expose only authoritative fields. Frontend runtime code must not backfill missing avatar, relationship, asset or scene-detail values with production-looking fixtures.

## Persistence boundary

Application/domain repository ports remain persistence-neutral. Production infrastructure uses MyBatis + explicit SQL + PostgreSQL. The backend build has no JPA dependency and production source has no direct `JdbcTemplate` persistence.

## Dependency direction

```text
API adapters -> application use cases -> domain
application -> outbound ports
infrastructure -> application/domain contracts
worker -> persisted execution/media contracts + provider/storage adapters
```

Provider/vendor/storage branches stay in adapters, not domain policy.
