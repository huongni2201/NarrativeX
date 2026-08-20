# NarrativeX Data Flow and Durability Model — V1.11

PostgreSQL state, not Redis messages or process memory, determines what NarrativeX believes happened.

## Authority matrix

| Concern | Authority | Notes |
|---|---|---|
| Project/StoryVersion/Chapter/storyboard/continuity | PostgreSQL | ownership and versioning apply |
| GenerationJob/StageAttempt/ProviderOperation | PostgreSQL | Redis may carry hints only |
| MediaPlan / production policy | PostgreSQL | worker executes the persisted authorized revision |
| Narration document/set/timeline metadata | PostgreSQL | source and narration fingerprints pin immutable inputs |
| Durable audio/image/video/subtitle/final bytes | Cloudflare R2 | private by default; DB owns metadata/lineage |
| Worker render/media workspace | Local filesystem | ephemeral only |
| Browser session | Redis via Spring Session | availability dependency, not business-state authority |

## Chapter Analyze

```text
persisted Chapter
  -> lock/reload authoritative snapshot
  -> admission + atomic reservation
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker claim/lease/heartbeat
  -> ProviderOperation
  -> validated structured result
  -> stale-snapshot re-check
  -> continuity/storyboard materialization
```

## Narration selection

```text
NarrationStrategy.TTS
  -> TTS_GENERATE
  -> AUDIO_ALIGN

NarrationStrategy.USER_PROVIDED_AUDIO
  -> AUDIO_ALIGN
  -> no TTS_GENERATE
```

User-provided parts are ordered and mapped onto one logical global audio clock. One part can cover multiple Chapters; Chapter boundaries come from source/alignment, not file boundaries.

## Media execution

```text
valid analysis/review + narration timeline
  -> backend creates immutable MediaPlan revision
  -> job pins exact plan revision
  -> worker executes resolved strategies
  -> provider/local result
  -> validate bytes
  -> R2
  -> PostgreSQL MediaAsset metadata
  -> downstream render
```

A retry/reclaimed job must reuse an already-valid R2 asset when possible instead of regenerating merely because local scratch disappeared.

## Current gaps

- production user-audio upload/finalize and real alignment runtime hardening;
- VisualScenePlanner;
- production image-generation vertical slice;
- immutable image asset approval/lineage lifecycle;
- IMAGE_MOTION render/final export;
- complete actual-usage/billing reconciliation and release;
- remaining MyBatis migration;
- full Character/reference and approved-storyboard workflows;
- broader moderation/SSRF/retention/observability/DR evidence.
