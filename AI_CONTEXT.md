# NarrativeX AI coding context

NarrativeX is an image-first AI Story Video Studio. It turns flexible-length stories into reviewed storyboard/media state, narration, generated visuals and FFmpeg-rendered long-form or Short/Reel artifacts.

## Current repository shape

- `app/backend-service`: Spring Boot modular monolith; domain and durable orchestration authority.
- `app/ai-worker`: Python AI/media worker; provider adapters, TTS, R2 media operations, FFmpeg render and Google Drive final-video upload.
- `app/frontend-web`: Next.js + TypeScript UI; storyboard/review/cost/notification experience.
- `documentation`: canonical implementation-facing product, domain, architecture, workflow and codebase notes.
- `contracts`: versioned cross-runtime payload contracts.
- `docker-compose.yml`: safe local PostgreSQL/Redis/backend/worker stack.
- `docker-compose.prod.yml`: production stack with separate AI, narration and render workers.

## Current durable storage contract

```text
Generated images          -> Cloudflare R2
Generated narration       -> Cloudflare R2
Accepted uploaded audio   -> Cloudflare R2
Reusable pipeline media   -> Cloudflare R2
Final rendered MP4        -> Google Drive
Metadata / lineage / state -> PostgreSQL
Worker local filesystem   -> ephemeral scratch
```

ADR-0012 governs R2 pipeline media. ADR-0016 governs final rendered MP4 storage.

## Implemented media foundations

- real Vertex image generation with validated R2-backed image assets;
- Google TTS and local VieNeu narration paths with R2-backed narration;
- dedicated `CHAPTER_RENDER` worker using deterministic FFmpeg IMAGE_MOTION;
- ffprobe validation and SHA-256 before completion;
- Google Drive resumable final-video upload with render-fingerprint lookup/idempotency;
- FinalArtifact provider metadata including Drive file ID and optional web-view link;
- final MP4 is not duplicated into R2 by default.

## Current V1.11 priorities

- harden production user-audio upload/finalize/alignment;
- connect aligned multi-part uploaded audio to render slicing/stitching;
- complete narration-driven `VisualScenePlanner` and review workflow;
- harden image approval/reuse/reframe/edit lineage;
- implement owner-authorized preview/download/streaming for Drive-backed final videos;
- add cross-attempt Drive upload retry without rerender if required;
- complete actual-cost reconciliation, moderation/SSRF/retention/observability/DR evidence.

Production persistence is MyBatis + explicit SQL across backend features. JPA and direct `JdbcTemplate` persistence are absent from production code.

## Important constraints

Do not encode fixed duration or fixed image-count assumptions. Do not put provider/R2/Drive credentials or refresh tokens in the browser. Do not mark a final artifact ready before FFmpeg validation, remote Drive durability/verification and PostgreSQL metadata commit. Do not overwrite immutable history when regenerating.

The current render worker loads generated narration matching the pinned Chapter row-version/source-hash. Do not claim complete multi-part `USER_PROVIDED_AUDIO` rendering until aligned audio parts are sliced/stitched into render input.

The Drive adapter supports resumable upload within an attempt and can reuse an already-uploaded file by render fingerprint. The local render workspace is still ephemeral across stalled/reclaimed attempts, so do not claim upload-only retry across worker attempts yet.

Character model:
- Character = reusable User/Workspace-owned identity.
- ProjectCharacter = Character assignment within one Project.
- CharacterVersion = immutable identity snapshot.
- CharacterAppearance = story/timeline visual state.
- Scene/VisualBeat generation resolves only participating ProjectCharacters.
- Never duplicate Character solely for outfit/age/hairstyle/injury changes.
- Never use character name as a relational identity key.

Project Character list/detail screens consume project-scoped authoritative backend read models. Do not reintroduce fabricated runtime Character business data for fields the backend intentionally leaves unavailable.
