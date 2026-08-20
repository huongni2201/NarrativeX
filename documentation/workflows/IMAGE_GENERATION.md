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
