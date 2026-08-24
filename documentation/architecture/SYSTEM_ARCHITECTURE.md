# NarrativeX System Architecture — V1.11

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

NarrativeX is a Spring Boot modular monolith with separately deployed Python worker roles. The backend owns browser/API authorization, business policy, source snapshots, MediaPlan authorization and durable control-plane state. Workers own asynchronous execution mechanics.

ADR-0003 governs R2-backed source/generated/reusable pipeline media and Google Drive final rendered MP4 exports.

## Logical topology

```text
Browser / Next.js Studio       Electron Desktop Editor
        |                                |
        |                         system browser OAuth
        |                                |
        +---------------+----------------+
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

The backend owns Google OIDC identity, browser session/CSRF, Desktop token/device authorization,
ownership, entitlement/quota admission, persisted Chapter/source identity, durable jobs/outbox,
immutable MediaPlan authorization, production mode/MotionStrategy resolution, durable media/
final-artifact metadata and Flyway schema ownership.

The desktop renderer is an editor client, not a second domain authority. Electron main/preload owns
system-browser OAuth callbacks, safeStorage, local device heartbeat, cache and FFmpeg capabilities;
durable business state, entitlement and render progress remain backend-owned according to ADR-0010
and ADR-0011.

The Chapter Workspace resolves the current visual media identity from the durable
`chapter_media_heads` projection. Frontend refresh/hydration must not rely on an optimistic media
cache or an arbitrary latest-job query.

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

## Architecture guards and pipeline observability

Backend architecture tests enforce framework-free domains, domain feature isolation (apart from the
shared `feature.common` kernel), API isolation from infrastructure/outbound ports, and the inward
dependency direction of infrastructure adapters.

Worker pipeline metric lines include `jobId`, `projectId`, `chapterId`, `mediaPlanId`,
`renderFingerprint`, and `artifactId` when available. The tracked observations include generation,
image generation, TTS, render/FFmpeg, final-video upload and size, plus final-artifact range
requests and streamed bytes. This makes a render failure traceable from its job identifier without
making Redis or worker process memory authoritative.

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
- richer owner-authorized Drive publishing/entitlement hardening around the implemented preview/download/streaming proxy;
- cross-attempt Drive upload-only retry;
- HYBRID_LOCAL_I2V hardening and broader production safety/observability work.
