# Image Generation Workflow — V1.11

Image generation produces immutable image MediaAssets for visual scenes. I2V is a separate optional motion path.

## First vertical slice

V1.11 intentionally allows the first reliable media slice to skip the full reuse engine:

```text
VisualScenePlan
  -> GENERATE_NEW
  -> ProviderOperation
  -> provider output
  -> worker-local scratch
  -> validate
  -> Cloudflare R2
  -> immutable MediaAsset metadata
  -> stage complete
```

This is delivery sequencing, not a change to the long-term reuse-first policy.

## Long-term asset resolution

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

Derived assets preserve lineage and only billable operations contribute provider workload.

## Durable provider rules

- persist request identity/ProviderOperation before external submission;
- use CAS/allowed-state transitions;
- ambiguous outcome becomes `UNKNOWN` and reconciles before resubmit;
- completed result is immutable except idempotent same-fingerprint replay;
- provider URL/local path is never authoritative media identity.

## Validation before completion

At minimum:

- decode/media type succeeds;
- positive dimensions;
- aspect/crop policy recorded;
- checksum/content hash;
- provider response schema validated;
- immutable R2 upload succeeds;
- PostgreSQL MediaAsset metadata commits.

Identity/moderation/review gates may then decide approval/regeneration without overwriting historical attempts.
# Image generation workflow

The MVP image workflow is a backend-authorized `CHAPTER_GENERATE` job. The backend snapshots the
current approved storyboard, READY narration/alignment identity, safe character context, image
settings, provider/model/pricing version, and exact source revision into an immutable `MediaPlan`.

The worker creates at most one provider operation for each stable beat request fingerprint. A
timeout, network failure, or ambiguous provider response is persisted as `UNKNOWN`; it is reconciled
when the provider supports reconciliation and is never automatically blind-resubmitted otherwise.
Provider bytes are acquired into private R2 result objects before durable completion is recorded.

Validated output creates/reuses a READY `MediaAsset` and an insert-only lineage row. Review is a
separate state machine: `NEEDS_REVIEW` must become `APPROVED` before the asset can enter a render
manifest. Rejection does not mutate or delete the generated asset; regeneration is a new explicit
paid attempt.
