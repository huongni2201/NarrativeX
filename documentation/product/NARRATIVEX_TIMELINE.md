# NarrativeX — Implementation Timeline

This file is a dependency-ordered planning view. It does not promise fixed calendar dates. Current status is derived from V1.10 source-of-truth plus repository evidence.

## Current checkpoint

### Foundation — IMPLEMENTED

- Spring Boot modular monolith + Next.js frontend + Python worker.
- PostgreSQL authoritative state.
- Redis-backed browser sessions plus non-authoritative generation hints.
- Project/StoryVersion/Chapter foundations.
- Chapter batch import.
- Explicit durable Chapter Analyze.
- Worker claim/lease/heartbeat and bounded concurrency.
- ProviderOperation durability/reconciliation foundation.
- Character + Location analysis continuity and Scene relations.
- Storyboard/VisualBeat read/review foundations.

## Next phase — Review completion

### Character review — PARTIAL

- version editing/diff;
- approve/lock semantics;
- reference asset workflow;
- deterministic reviewed snapshot resolution.

### Storyboard review — PARTIAL

- broader Scene/VisualBeat editing;
- ordering/deep links;
- approved reset/versioning workflow.

## Media phase

### Image generation — PENDING

- one provider adapter;
- durable stage + ProviderOperation;
- private object storage;
- Asset metadata/checksum/dimensions;
- review/regenerate.

### TTS/subtitles — PENDING

- one TTS adapter;
- narration audio asset;
- timing/subtitle metadata;
- output validation.

### Render/export — PENDING

- deterministic FFmpeg baseline;
- RenderVersion;
- FinalArtifact validation;
- preview/download.

## Production-hardening phase — PARTIAL

- actual provider usage and billing reconciliation;
- unused reservation release/refund;
- broader provider resilience/observability;
- complete moderation/consent/abuse coverage;
- deletion/retention;
- backup/restore drills;
- real-provider E2E/load/recovery testing.

## Architecture baseline

```text
Next.js frontend
  -> Spring Boot API
       -> PostgreSQL
       -> Redis session/transient hints

PostgreSQL durable work
  -> Python worker
       -> provider adapters
       -> Cloudflare R2 media storage (future media stages)
```

Do not use Node.js as a backend alternative, RabbitMQ as an assumed queue authority, or OpenAI/Runway/Pika as current provider claims unless those technologies are actually introduced by a later accepted implementation decision.

## Planning principles

- PostgreSQL remains durable authority.
- Project/Chapter save does not auto-run AI.
- Provider work requires durable lifecycle state.
- `UNKNOWN` reconciles before resubmit.
- Media generation comes after reviewable continuity/storyboard state.
- Fixed video duration/image-count/"5–15 minute generation" numbers are product hypotheses, not architecture invariants.
- Public launch is blocked by unresolved P0/P1 integrity/security/safety issues and missing production evidence.
