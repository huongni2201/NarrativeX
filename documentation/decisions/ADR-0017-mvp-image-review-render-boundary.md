# ADR-0017: MVP image generation, review, and IMAGE_MOTION render boundary

- Status: Accepted for the MVP vertical slice
- Date: 2026-08-21

## Context

NarrativeX already has durable generation jobs, provider-operation fencing, immutable media plans,
private R2 storage, and a storyboard review boundary. The first real media slice needs to connect
those primitives without allowing a worker or browser to change the backend-authorized inputs.

## Decision

The MVP has two expensive commands:

1. `CHAPTER_GENERATE` creates one `GENERATE_NEW` keyframe per approved VisualBeat in an immutable
   `MediaPlan` revision. Provider execution status is stored per beat in `media_generation_items`.
2. `CHAPTER_RENDER` is a separate command. It is admitted only after every required item is
   explicitly approved and persists an immutable render manifest containing the exact asset and
   narration inputs. The worker performs deterministic `IMAGE_MOTION` rendering with FFmpeg.

Execution and human review are separate state machines. Validated bytes may create a `READY`
`MediaAsset` while its item remains `NEEDS_REVIEW`; only `APPROVED` items are renderable. A rejected
item remains available for audit and a new generation attempt must use a new admission/idempotency
key. Asset checksum deduplication may reuse a canonical `media_assets` row, but every logical beat
gets its own insert-only `media_asset_lineage` row.

The worker receives provider-neutral contracts. Provider/model/pricing selection, entitlement,
cost reservation, source revisions, and participating character snapshots are backend authority.
Provider SDKs and credentials stay out of backend domain/application code. Large provider bytes are
acquired into a private, non-deliverable R2 result object; normalized provider JSON stores only
bounded metadata and object identity.

## Provider capability gate

The initial Vertex image adapter is enabled only when its configured endpoint, authentication,
model/location, output encoding, pricing snapshot, safety signal behavior, and reconciliation
behavior are verified by adapter tests and an operator-owned staging check. If the endpoint cannot
reconcile by operation ID or idempotency key, `supports_operation_reconciliation=false` is explicit.
Timeouts, network failures, and ambiguous 5xx responses become `UNKNOWN` and are never blind-
resubmitted automatically.

## Consequences

- Image generation never implicitly starts video generation or I2V.
- Worker restart can replay durable provider results without another paid provider call.
- API DTOs expose authorized metadata only; storage keys, signed URLs, prompts, credentials, and raw
  provider payloads are never serialized.
- `HYBRID_LOCAL_I2V`, reuse/reframe/edit strategies, batch generation, and project/short rendering
  remain outside this MVP.

