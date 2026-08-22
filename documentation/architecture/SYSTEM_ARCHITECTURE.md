# NarrativeX System Architecture — V1.11

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

NarrativeX is a Spring Boot modular monolith with a separately deployed Python AI/media worker. The backend owns browser/API authorization, business policy, source snapshots, MediaPlan authorization and durable control-plane state. The worker owns asynchronous execution mechanics.

Accepted ADRs refine cross-cutting decisions. ADR-0016 supersedes the older R2-only rule specifically for final rendered MP4 exports.

## Logical topology

```text
Browser / Next.js Studio
        |
        v
Spring Boot Backend
  -> PostgreSQL      authoritative domain/job/plan/usage/storage metadata
  -> Redis           Spring Session + transient/non-authoritative hints
  -> Cloudflare R2   private durable source/generated/reusable media
  -> Google Drive    private durable final rendered MP4 exports
        |
        v
Python AI / Media Worker
  -> provider adapters
  -> narration/alignment execution
  -> image/media execution
  -> optional I2V
  -> FFmpeg scratch/render
  -> R2 media validation/promotion
  -> final-video validation + Google Drive promotion
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
- final-video storage-provider identity and FinalArtifact state;
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

All production persistence uses MyBatis + explicit SQL, including generation outbox enqueue and dispatcher claim/lease.

The backend build has no JPA dependency and production source has no `JdbcTemplate`; architecture and PostgreSQL integration tests protect this boundary.

Shared rules: explicit row models/result maps, SQL CAS/allowed-state predicates, affected-row validation, shared Spring DataSource/transaction boundary, PostgreSQL Testcontainers evidence.

## Frontend read-model authority

Project Character list/detail is now a real project-scoped vertical slice. The backend authorizes project ownership and exposes read projections for canonical/project aliases, role, importance, groups, pinned version, appearance and scene usage. The frontend consumes those projections and intentionally leaves unsupported fields unavailable rather than fabricating them.

## Durable media boundaries

NarrativeX uses two durable binary-media lifecycles:

```text
Source/generated/reusable pipeline media
  -> Cloudflare R2

Final rendered MP4 export
  -> Google Drive through FinalVideoStorage
```

Worker-local files are scratch/cache/FFmpeg workspace only and are never authoritative durable references.

An R2-backed media-producing stage completes only after:

```text
execute/fetch
  -> local scratch
  -> validate
  -> upload immutable bytes to R2
  -> persist MediaAsset metadata in PostgreSQL
  -> mark stage complete
```

A final rendered video completes through a separate boundary:

```text
R2-backed inputs
  -> local FFmpeg final.mp4
  -> validate
  -> Google Drive resumable upload
  -> verify remote object
  -> persist FinalArtifact storage metadata in PostgreSQL
  -> READY
  -> delete local final when safe
```

If Drive upload fails after a successful render, retry upload from the validated local MP4 instead of rerendering.

## First complete media target

```text
analysis/review state
  -> TTS or USER_PROVIDED_AUDIO aligned timeline
  -> VisualScenePlanner
  -> image generation (MVP may GENERATE_NEW)
  -> immutable R2 image MediaAsset
  -> IMAGE_MOTION FFmpeg render to local scratch
  -> validate final MP4
  -> Google Drive FinalVideoStorage promotion
  -> verify + persist FinalArtifact metadata
  -> READY
```

Reuse/reframe/edit and HYBRID_LOCAL_I2V are fast-follow optimizations after the first durable MP4.
