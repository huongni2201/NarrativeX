# NarrativeX System Architecture — V1.11

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

NarrativeX is a Spring Boot modular monolith with separately deployed Python worker roles. The backend owns browser/API authorization, business policy, source snapshots, MediaPlan authorization and durable control-plane state. Workers own asynchronous execution mechanics.

ADR-0012 governs R2-backed source/generated/reusable pipeline media. ADR-0016 supersedes the old R2-only rule specifically for final rendered MP4 exports.

## Logical topology

```text
Browser / Next.js Studio
        |
        v
Spring Boot Backend
  -> PostgreSQL      authoritative domain/job/plan/usage/storage metadata
  -> Redis           Spring Session + transient/non-authoritative hints
        |
        v
Python worker roles
  -> analysis / translation
  -> narration / alignment
  -> Vertex image generation
  -> media validation
  -> IMAGE_MOTION FFmpeg render
        |
        +--> Cloudflare R2   source/generated/reusable pipeline media
        +--> Google Drive    final rendered MP4 exports
```

## Backend authority

The backend owns session/CSRF and ownership, entitlement/quota admission, persisted Chapter/source identity, durable jobs/outbox, immutable MediaPlan authorization, production mode/MotionStrategy resolution, durable media/final-artifact metadata and Flyway schema ownership.

Workers execute persisted policy and must not invent paid or I2V work outside the authorized plan.

## Narration architecture

```text
selected source scope
   +--> generated TTS/VieNeu --------+
   +--> USER_PROVIDED_AUDIO ---------+--> narration timeline/alignment
```

Generated narration has a working R2-backed execution path and can be consumed by the current render worker when it matches the pinned Chapter row-version/source-hash.

`USER_PROVIDED_AUDIO` has ordered-part/global-clock/TTS-bypass foundations, but aligned multi-part audio is not yet sliced/stitched into the current chapter render input. That E2E path remains partial.

## Persistence direction

Production persistence uses MyBatis + explicit PostgreSQL SQL. The backend build has no JPA dependency and production source has no direct `JdbcTemplate` persistence.

## Durable media boundaries

```text
Generated images / narration / accepted uploaded audio / reusable media
  -> Cloudflare R2

Final rendered MP4
  -> Google Drive

Metadata / state / lineage / storage identity
  -> PostgreSQL

Worker-local render/media files
  -> ephemeral scratch only
```

R2-backed pipeline stages complete only after validated bytes are durable in R2 and PostgreSQL metadata is committed.

The current final-video path is:

```text
pinned R2 image + generated narration inputs
  -> local FFmpeg IMAGE_MOTION
  -> ffprobe validation + SHA-256
  -> Google Drive resumable upload
  -> remote file ID/size verification
  -> render_manifest + FinalArtifact metadata
  -> render stage/job COMPLETED
```

The final MP4 is not uploaded to R2 by default.

## Drive retry semantics

The Drive adapter can resume an interrupted upload inside one worker attempt and can find/reuse an already-uploaded file by `renderFingerprint` on a later retry.

The rendered `final.mp4` itself currently lives in an ephemeral job workspace. If a Drive failure causes the attempt to exit and the job is later reclaimed, the next attempt may rerender. A durable upload-only retry boundary across worker attempts remains a hardening target.

## Current media status

Implemented foundations:

- real Vertex image generation to R2;
- generated narration to R2;
- deterministic IMAGE_MOTION chapter render;
- ffprobe/checksum validation;
- Google Drive final-video storage and provider-aware FinalArtifact metadata.

Still incomplete:

- complete production user-audio ingestion/alignment/render path;
- narration-driven `VisualScenePlanner` and review workflow;
- richer image approval/reuse/reframe/edit lineage;
- owner-authorized Drive preview/download/streaming;
- cross-attempt Drive upload-only retry;
- HYBRID_LOCAL_I2V hardening and broader production safety/observability work.
