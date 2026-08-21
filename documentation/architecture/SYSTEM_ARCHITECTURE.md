# NarrativeX System Architecture — V1.11

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

NarrativeX is a Spring Boot modular monolith with a separately deployed Python AI/media worker. The backend owns browser/API authorization, business policy, source snapshots, MediaPlan authorization and durable control-plane state. The worker owns asynchronous execution mechanics.

## Logical topology

```text
Browser / Next.js Studio
        |
        v
Spring Boot Backend
  -> PostgreSQL      authoritative domain/job/plan/usage metadata
  -> Redis           Spring Session + transient/non-authoritative hints
  -> Cloudflare R2   private durable media bytes
        |
        v
Python AI / Media Worker
  -> provider adapters
  -> narration/alignment execution
  -> image/media execution
  -> optional I2V
  -> FFmpeg scratch/render
  -> validation + R2 promotion
```

## Backend authority

The backend owns:

- session/CSRF, ownership and entitlements;
- persisted Chapter/source snapshot authority;
- safety/quota/cost admission;
- durable job/outbox orchestration;
- immutable/versioned MediaPlan authorization;
- production mode and MotionStrategy resolution;
- durable media metadata/access contracts;
- Flyway schema ownership.

The worker must not invent paid/I2V work outside the persisted plan.

## Narration architecture

```text
selected source scope
   +--> TTS ------------------+
   +--> USER_PROVIDED_AUDIO --+--> NarrationTimeline --> alignment --> visual planning
```

Current foundations include full-chapter TTS and user-provided audio planning/timeline logic. User-provided audio can be one or many ordered parts; file boundaries are not Chapter boundaries. Its operation plan omits TTS generation.

## Persistence direction

MyBatis/explicit-SQL production paths now cover ProviderOperation, Chapter, Project, GenerationJob, StageAttempt, OperationPlan, MediaPlan, generation outbox enqueue, Job History and the Chapter Analyze safety gate. The outbox dispatcher still uses JDBC for its short-lived operational claim/lease query.

New persistence-heavy work converges on explicit MyBatis SQL and PostgreSQL; remaining JPA/JDBC adapters are migration-era surfaces. The next major persistence targets are StoryVersion, quota/billing, storyboard/continuity and remaining low-risk CRUD/query boundaries.

Shared rules: explicit row models/result maps, SQL CAS/allowed-state predicates, affected-row validation, shared Spring DataSource/transaction boundary, PostgreSQL Testcontainers evidence.

## Frontend read-model authority

Project Character list/detail is now a real project-scoped vertical slice. The backend authorizes project ownership and exposes read projections for canonical/project aliases, role, importance, groups, pinned version, appearance and scene usage. The frontend consumes those projections and intentionally leaves unsupported fields unavailable rather than fabricating them.

## Durable media boundary

Cloudflare R2 is the sole durable media object store across environments. Worker-local files are scratch/cache/FFmpeg workspace only.

A media-producing stage completes only after:

```text
execute/fetch
  -> local scratch
  -> validate
  -> upload immutable bytes to R2
  -> persist MediaAsset/FinalArtifact metadata in PostgreSQL
  -> mark stage complete
```

## First complete media target

```text
analysis/review state
  -> TTS or USER_PROVIDED_AUDIO aligned timeline
  -> VisualScenePlanner
  -> image generation (MVP may GENERATE_NEW)
  -> immutable R2 image MediaAsset
  -> IMAGE_MOTION FFmpeg render
  -> validated R2 FinalArtifact
```

Reuse/reframe/edit and HYBRID_LOCAL_I2V are fast-follow optimizations after the first durable MP4.
