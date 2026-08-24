# Image Generation Workflow — V1.11

Image generation produces immutable image MediaAssets for visual scenes. I2V is a separate optional motion path.

## First vertical slice

V1.11 intentionally allows the first reliable media slice to skip the full reuse engine:

```text
VisualScenePlan
  -> SHOT_IMAGE_GENERATE StageAttempt (lease + SKIP LOCKED)
  -> queued MediaGenerationItems
  -> RESERVED ProviderOperation (committed fence)
  -> Vertex BatchPredictionJob
  -> reconcile/recover UNKNOWN by deterministic display name
  -> validate and correlate every output by echoed instance
  -> Cloudflare R2 immutable object
  -> one atomic PostgreSQL materialization transaction
  -> MediaAsset + lineage + item READY
  -> provider operation complete for the current batch
  -> stage/job remains RUNNING while any job item is pending
  -> terminal stage/job is FAILED when any item failed, otherwise COMPLETED when all are READY
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
- deterministic provider failures (`HTTP 4xx`, provider `FAILED`, invalid/correlated output) are
  persisted as `FAILED`; only timeouts, network failures, HTTP 5xx, and genuinely unresolved
  outcomes remain `UNKNOWN`; internal worker failures are persisted as `FAILED` with
  `IMAGE_WORKER_INTERNAL_ERROR`;
- completed result is immutable except idempotent same-fingerprint replay;
- provider URL/local path is never authoritative media identity.
- the image worker claims `SHOT_IMAGE_GENERATE` directly from PostgreSQL; it does not call the
  backend over HTTP to claim work;
- a `RESERVED` operation is fenced to `UNKNOWN` before Vertex submission, so a crash cannot cause
  a blind second paid POST;
- the claimed worker's heartbeat and processing task are joined: lease loss cancels processing,
  and a final `(stage_attempt_id, worker_id, lease_token, status=RUNNING)` fence runs immediately
  before every new provider submission; claimed-worker DB mutations carry the same lease fence;
- batches are capped by `VERTEX_IMAGE_BATCH_MAX_ITEMS` and duplicate request bodies are split into
  separate batches because positional output matching is forbidden;
- completing one provider batch never completes the parent stage/job by itself: the worker
  aggregates every `media_generation_items` row for the generation job, preserving `RUNNING` for
  `QUEUED`/`RUNNING`/`VALIDATING`/`UNKNOWN`, setting `FAILED` when no pending items remain and any
  item failed, and setting `COMPLETED` only when every item is `READY`;
- a missing, unknown, duplicate, or reordered-without-instance provider row fails closed with
  `BATCH_ITEM_CORRELATION_FAILED`.

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

## Visual style continuity

Each media job selects a server-owned `ImageStyle` profile. The selected profile is appended to
every beat's `prompt_snapshot`, and its server-owned negative prompt is persisted with the beat
plan. The style code is also recorded in `image_settings_json`, so retries and later review use
the same visual policy. The client sends only the allow-listed style code; it cannot supply an
arbitrary prompt suffix.

The current profiles are `CINEMATIC` and `STORYBOOK_WATERCOLOR`. A style profile improves global
visual consistency, while character continuity still depends on the immutable character snapshot
and approved reference assets.

The worker creates at most one provider operation for each stable beat request fingerprint. A
timeout, network failure, or ambiguous provider response is persisted as `UNKNOWN`; it is reconciled
when the provider supports reconciliation and is never automatically blind-resubmitted otherwise.
Provider bytes are acquired into private R2 result objects before durable completion is recorded.

Validated output creates/reuses a READY `MediaAsset` and an insert-only lineage row. Review is a
separate state machine: `NEEDS_REVIEW` must become `APPROVED` before the asset can enter a render
manifest. Rejection does not mutate or delete the generated asset; regeneration is a new explicit
paid attempt.

## Media Generation Operations & Review Signals

### Admission & Execution
- The backend authorizes `IMAGE_MOTION` for one Chapter at a time, snapshotting approved storyboard revisions, narration/alignment references, and provider pricing into `MediaGenerationItem` rows.
- The worker persists `ProviderOperation(RESERVED)` before external submission. Network 5xx/timeouts transition to `UNKNOWN` and require explicit reconciliation; blind retries are prohibited.
- Monitor jobs by execution status (`QUEUED`, `RUNNING`, `VALIDATING`, `READY`, `FAILED`, `UNKNOWN`) and review status (`NOT_READY`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`).
- When the authoritative image generation job reaches `COMPLETED`, PostgreSQL creates one unread in-app notification for the requesting user; the unique event key prevents duplicates during retries.

## Cloudflare R2 Browser Upload CORS Configuration

NarrativeX generates short-lived presigned R2 `PUT` URLs for client-side uploads. The target bucket must allow frontend origins and request headers in the Cloudflare Dashboard under **R2 → Settings → CORS Policy**:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "x-amz-checksum-sha256"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Or configure via Wrangler CLI:

```powershell
npx wrangler r2 bucket cors set narrativex-prod --file .\r2-cors.json
```
