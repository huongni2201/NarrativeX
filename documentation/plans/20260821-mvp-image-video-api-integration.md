# Implementation Plan: MVP Image Generation và IMAGE_MOTION Video

- **Status:** Draft — implementation-ready after the provider capability gate below is resolved
- **Updated:** 2026-08-21
- **Scope:** One Chapter, generated keyframes, deterministic FFmpeg render, private R2 delivery
- **Testing approach:** Regular implementation; every task includes focused tests before the next task starts

## 1. Outcome

Hoàn thiện vertical slice media đầu tiên của NarrativeX bằng API thật và durable state thật:

```text
Persisted Chapter + current storyboard revision with required beats approved
  + READY narration/alignment timeline
  -> backend-authorized immutable MediaPlan
  -> CHAPTER_GENERATE job + OperationPlan + reservation + StageAttempt + outbox
  -> worker generates one keyframe per planned VisualBeat
  -> bounded acquire -> private immutable R2 result -> durable provider completion
  -> validate/moderate -> MediaAsset + lineage in PostgreSQL
  -> user approves/rejects generated keyframes
  -> CHAPTER_RENDER job pinned to exact approved inputs
  -> deterministic IMAGE_MOTION + FFmpeg
  -> validate -> immutable R2 object -> FinalArtifact
  -> authorized preview/download
```

Image generation và render là **hai expensive commands riêng biệt**. Image job không tự động tạo video. Cách tách này giữ idempotency, cost authorization, retry và review boundary rõ ràng.

## 2. MVP boundary

### In scope

- `GENERATE_NEW` cho mỗi VisualBeat thuộc storyboard revision hiện hành.
- Một image provider thật qua worker-side provider-neutral port. Adapter đầu tiên dùng Vertex image generation nếu capability gate ở mục 6 đạt.
- `ProductionMode.IMAGE_MOTION` duy nhất trong public MVP flow.
- Snapshot đầy đủ prompt-safe context, image settings, participating character versions, narration/alignment identity và timing vào immutable `MediaPlan` revision.
- Per-beat execution tracking, provider fencing, idempotent materialization, review state và asset lineage.
- Deterministic pan/zoom/hold/fade bằng FFmpeg; narration timeline là duration authority.
- PostgreSQL là durable business authority; Cloudflare R2 là durable bytes authority; local disk chỉ là bounded scratch.
- Spring Security session + CSRF; identity chỉ lấy từ `SecurityContextHolder`/`CurrentUserId`.
- Server-authoritative entitlement, abuse/concurrency checks, cost estimate/cap, reservation và usage settlement.
- Browser flow thật: generate -> progress -> review -> render -> preview/download.

### Explicitly out of scope

- `HYBRID_LOCAL_I2V`, Wan execution wiring và commercial I2V.
- `REUSE_APPROVED`, `REFRAME_DERIVED`, `EDIT_EXISTING` và reuse-first resolver đầy đủ.
- Project/short render, subtitle burn-in nâng cao, batch generation và provider marketplace.
- Xây mới Character locking UI. MVP vẫn phải snapshot existing pinned/approved `CharacterVersion` và approved references của participating characters; thiếu required lock/consent thì admission fail closed.
- Provider/model selection từ browser. Browser chọn product-level quality/aspect settings; backend resolve và snapshot provider/model authoritative.

Fast-follow work không có checkbox trong plan MVP này để tránh bị hiểu là release requirement. Xem mục 18.

## 3. Evidence from the current repository

| Area | Existing foundation | Gap that this plan closes |
| --- | --- | --- |
| Backend execution | `GenerationJob`, `StageAttempt`, `OperationPlan`, quota reservation, generation outbox, `ProviderOperation` | No media admission command or per-beat execution record |
| Media planning | `CreateMediaPlanUseCase`, immutable `MediaPlan`, `MediaScenePlan`, `MediaBeatPlan` | Snapshot lacks storyboard revision, narration/alignment identity, safe prompt context, image settings and beat timing |
| Persistence | Consolidated Flyway V1/V2, `media_assets`, `render_manifests`, `final_artifacts`, immutable media-plan triggers | Generation-item/review and generated-asset lineage are now part of the development baseline; render manifest pins queryable ownership and narration identities |
| Worker | PostgreSQL lease/heartbeat, pre-submit `UNKNOWN` fence, Vertex analysis adapter, R2 storage, Wan contract foundation | Main worker only claims `CHAPTER_ANALYZE`; durable provider result is typed to `ChapterAnalysisResult`; no image/render handler |
| Asset APIs | Upload/list/approve/delete under `/api/v1/assets`; private R2 foundation | No single generated-asset metadata/download endpoint and no generated-lineage query |
| Render APIs | Existing `POST .../render`, `/api/v1/artifacts/{id}`, render manifest/final artifact schema | Render admission uses fixed cost and workspace projection, worker does not render, download signing is unfinished |
| Frontend | Chapter Workspace, Storyboard, job polling, Asset Library, VisualReview/Render scaffolds | Visuals/Audio/Render tabs unavailable; production components still contain placeholder/runtime demo data |

This table is the implementation baseline. Re-run the same discovery before each slice because the worktree may advance while this plan is being implemented.

## 4. Architecture decisions and invariants

1. **Backend plans; worker executes.** The worker may validate provider capability but must not select a more expensive provider, change production mode or add I2V work.
2. **Persist authorization before external work.** Admission transaction creates the immutable plan, job, operation plan, reservation, stage attempt, per-beat items and outbox. The worker creates/reuses `ProviderOperation(RESERVED)` before each provider call.
3. **Ambiguous means `UNKNOWN`.** The pre-submit CAS fence remains `RESERVED -> UNKNOWN`. A timeout/network/ambiguous 5xx never becomes automatic resubmit.
4. **Execution and review are separate state machines.** Successfully validated bytes may be `MediaAsset.READY` while the generation item is `NEEDS_REVIEW`. Render admission requires `APPROVED` review state.
5. **Asset dedup does not erase lineage.** Existing account + SHA-256 dedup may reuse one `media_assets` row, but every beat/job/plan relationship receives its own immutable lineage row.
6. **R2/DB materialization is replayable.** A provider result may be replayed into R2/PostgreSQL after a crash without calling the provider again. Object keys are server-generated and checksum-stable.
7. **No storage identifiers in public DTOs.** Browser responses expose authorized metadata/URLs, never `storage_key`, provider URL, credentials or raw provider payload.
8. **Untrusted data stays bounded.** Story text, prompts, references and provider output are validated, size-limited, moderated and excluded/redacted from normal logs.
9. **Current source remains pinned.** A stale Chapter row version/source hash/storyboard revision/narration alignment blocks admission or execution; the worker never silently switches to newer inputs.
10. **MVP is all-required-items.** An image job is `COMPLETED` only when every planned item has durable validated output. If any item definitively fails, the job is `FAILED`; successful assets remain available for an explicit new attempt. Any ambiguous item keeps the job `UNKNOWN`.
11. **Large provider bytes never enter JSONB.** `normalized_result_json` stores bounded metadata plus an internal immutable R2 result-object identity and SHA-256, never base64 image bytes. A provider response is acquired with byte/time limits, written to a private non-deliverable result object, then the ProviderOperation completion is persisted. Full decode/moderation logically promotes the same verified object to a `MediaAsset`; rejected/quarantined objects follow restricted retention and are never signed for clients.

Existing ADRs 0008, 0009, 0012, 0015 and 0016 remain authoritative. Add ADR-0017 only for new decisions not already covered: the two-command image/review/render boundary, per-beat execution/review split and generated-asset lineage.

## 5. Definition of Ready

Media admission must reject with a stable actionable error code unless all required conditions hold:

- Chapter belongs to the current user/project and has unchanged `row_version` + `source_hash`.
- Chapter points to a current storyboard revision and every included VisualBeat is approved for generation.
- Narration set/alignment run is `READY`, covers the Chapter and supplies valid ordered audio spans.
- Every participating character resolves only to an allowed pinned/approved `CharacterVersion` and approved reference assets; required real-person consent is current.
- `IMAGE_MOTION` is entitled for the account and requested aspect/quality are within server-side entitlement.
- Backend pricing catalog can estimate bounded attempts and reserve within `maxAuthorizedCost`, quota and concurrency limits.
- Image provider configuration, private R2 configuration and worker capability report are available. FFmpeg is additionally required for render admission.

Recommended error codes:

`STORYBOARD_NOT_READY`, `NARRATION_NOT_READY`, `ALIGNMENT_STALE`, `CHARACTER_VERSION_REQUIRED`, `CONSENT_REQUIRED`, `UNSUPPORTED_MEDIA_STRATEGY`, `PROVIDER_UNAVAILABLE`, `RENDERER_UNAVAILABLE`, `ENTITLEMENT_DENIED`, `COST_LIMIT`, `IDEMPOTENCY_CONFLICT`, `SOURCE_STALE`, `ASSET_REVIEW_REQUIRED`.

## 6. Provider capability gate

Before coding the first paid adapter, document the selected image endpoint's actual behavior in ADR-0017 and adapter tests:

- authentication mechanism and region/model configuration;
- synchronous versus asynchronous submission;
- maximum prompt/output size, supported aspect ratios and output encodings;
- stable provider operation ID or idempotent request key support;
- provider-native status/reconciliation capability;
- safety metadata and definitive versus ambiguous error classes;
- pricing unit and immutable pricing catalog version.

If the selected endpoint cannot retrieve an operation by ID/request key, the adapter must declare `supports_operation_reconciliation=false`. An ambiguous submission then remains `UNKNOWN`, clears automatic due reconciliation, records a redacted operator reason and **must not be resubmitted automatically**. The MVP release gate verifies this fail-safe path; it does not claim exactly-once provider execution where the provider cannot support it.

## 7. Public API contracts

### 7.1 Create image-generation job

`POST /api/v1/projects/{projectId}/chapters/{chapterId}/media-jobs`

Headers:

- `Idempotency-Key` required.
- Existing session cookie + CSRF header.

Request:

```json
{
  "productionMode": "IMAGE_MOTION",
  "aspectRatio": "16:9",
  "qualityTier": "STANDARD",
  "maxAuthorizedCost": "1.500000"
}
```

Rules:

- Only `IMAGE_MOTION` is accepted in this MVP.
- `imageModel`, provider key, user/account ID, storage key and output URL are not accepted from the client.
- Backend resolves project defaults, entitlement, provider/model/pricing snapshot and bounded attempt count.
- Same idempotency key + same canonical fingerprint returns the existing job. Same key + different fingerprint returns `409 IDEMPOTENCY_CONFLICT`.
- Admission denial occurs before any provider operation exists.

Response: `202 Accepted` using an additive extension of the existing `JobResponse`, so existing polling remains compatible:

```json
{
  "success": true,
  "message": "Media job queued",
  "data": {
    "jobId": "...",
    "type": "CHAPTER_GENERATE",
    "status": "QUEUED",
    "progress": 0,
    "currentStep": "QUEUED",
    "entityType": "CHAPTER",
    "entityId": 42,
    "target": { "type": "CHAPTER", "id": 42 },
    "errorCode": null,
    "mediaPlanId": "...",
    "mediaPlanRevision": 1,
    "estimate": {
      "currency": "USD",
      "minimum": "...",
      "expected": "...",
      "maximum": "...",
      "maxAuthorized": "..."
    }
  }
}
```

For non-media jobs the new media fields are absent/null. Do not create a second incompatible generic job shape.

### 7.2 Job summary and media details

- Keep `GET /api/v1/jobs/{jobId}` as the ownership-scoped generic summary.
- Add `GET /api/v1/media-jobs/{jobId}` for media-specific details: plan identity, estimate, item counts and ordered items.
- Item DTO exposes `visualBeatId`, execution status, review status, attempt number, authorized asset metadata/thumbnail URL and safe error code. It never exposes prompt/provider payload/storage key.

### 7.3 Review generated keyframe

`POST /api/v1/media-generation-items/{itemId}/review`

```json
{ "decision": "APPROVED", "rowVersion": 3 }
```

Allowed decisions: `APPROVED`, `REJECTED`. Review uses optimistic locking, owner/project authorization and immutable attempt history. Rejecting an item does not delete its asset. Regeneration is a new explicit attempt with a new cost admission/idempotency key.

### 7.4 Render Chapter

Keep the existing endpoint:

`POST /api/v1/projects/{projectId}/chapters/{chapterId}/render`

```json
{
  "mediaPlanId": "...",
  "mediaPlanRevision": 1,
  "resolution": "1080p",
  "format": "mp4",
  "maxAuthorizedCost": "0.500000"
}
```

`Idempotency-Key` is required. Backend builds and persists an immutable render manifest from exact approved image assets and narration inputs before queuing `CHAPTER_RENDER`. It must remove the current fixed `ESTIMATED_COST` path.

### 7.5 Asset and artifact delivery

- Add `GET /api/v1/assets/{assetId}` for owner-scoped metadata.
- Add `GET /api/v1/assets/{assetId}/download` for a short-lived authorized URL or redirect.
- Keep existing `GET /api/v1/artifacts/{artifactId}` and `/download`; finish private R2 signing there instead of introducing `/render-artifacts` aliases.
- Review and download authorization uses server identity plus asset account/project lineage; URL TTL is bounded and storage key is never serialized.

## 8. Persistence contract — consolidated Flyway V1

The repository is still on the development baseline. Fold the persistence
contract into `V1__initial_schema.sql`; keep `V2__seed_demo_data.sql` limited
to deterministic development fixtures. Do not leave a parallel feature migration
in the Flyway location.

### 8.1 Extend immutable plan snapshot

Add only fields not already represented:

- `media_plans`: `storyboard_revision_id`, `workflow_version`, `image_aspect_ratio`, `image_quality_tier`, authoritative `image_provider_key`, `image_model_key`, pricing snapshot/fingerprint, `narration_set_id`, `narration_alignment_run_id`.
- `media_beat_plans`: `asset_strategy`, prompt template/version and bounded prompt snapshot, negative prompt, audio start/end/duration, camera movement, image settings JSON, participating character-version/reference snapshot and snapshot fingerprint.

All JSON columns require shape/type checks where practical. Do not store credentials, provider bearer tokens, signed URLs or unrestricted raw response bodies.

### 8.2 Add `media_generation_items`

One logical beat may have multiple immutable attempts.

Required fields:

- identity: `id`, `generation_job_id`, `media_plan_id`, `visual_beat_id`, stable `item_key`, `attempt_number`;
- execution: `execution_status`, `provider_operation_id`, `media_asset_id`, request fingerprint, error code/detail-safe reference, timestamps, `row_version`;
- review: `review_status`, reviewer ID, reviewed timestamp;
- uniqueness: `(generation_job_id, item_key, attempt_number)` and one active attempt per logical item;
- indexes: job/status, beat/newest attempt, provider operation and review queue.

Canonical state values:

```text
execution_status: QUEUED -> RUNNING -> VALIDATING -> READY
                                  |-> FAILED / UNKNOWN

review_status:    NOT_READY -> NEEDS_REVIEW -> APPROVED / REJECTED
```

Do not overload `READY` to mean approved. `media_assets.status=READY` means validated durable bytes; `review_status=APPROVED` means usable for render.

### 8.3 Add `media_asset_lineage`

Required links: asset, account/project/chapter, VisualBeat, generation job, media plan, generation item, optional source asset, relation type, request/result fingerprints, redacted prompt/provider snapshots and creation time.

Lineage is insert-only. Multiple lineage rows may reference one deduplicated `media_assets` row. Add uniqueness for one logical lineage relationship, not uniqueness on `asset_id` alone.

### 8.4 Pin render inputs

`render_manifests` already has `render_fingerprint` and immutable JSON. Add `media_plan_revision`, narration/alignment identity and queryable status/ownership fields only where needed. The canonical manifest JSON must contain ordered input asset IDs + SHA-256, audio object IDs + SHA-256, timing, transforms, resolution, format, workflow/FFmpeg profile version and entitlement-derived watermark decision.

`final_artifacts` already contains output metadata and status. Prefer existing columns; add constraints/indexes only when a verified invariant is missing.

### 8.5 Migration safety tests

- Fresh database applies the active V1/V2 baseline; comment-only legacy
  tombstones may still be recorded as V3–V7 in the current checkout.
- Existing databases from the former split migration history require operator-reviewed
  recreation or explicit re-baselining; the application must not rewrite
  `flyway_schema_history` automatically.
- FK/check/partial unique/index behavior is covered in PostgreSQL integration tests.
- Immutability triggers cover new snapshot/lineage rows.
- Document roll-forward recovery; Flyway migration is not rolled back destructively in production.

## 9. Durable state transitions

```text
GenerationJob:
  QUEUED -> RUNNING -> COMPLETED
                    -> FAILED / UNKNOWN / STALLED / PAUSED_COST_LIMIT / CANCELED

StageAttempt:
  QUEUED -> RUNNING -> COMPLETED
                    -> FAILED / UNKNOWN / STALLED / PAUSED_COST_LIMIT / CANCELED

ProviderOperation (ADR-0008):
  RESERVED -> UNKNOWN
  UNKNOWN -> SUBMITTED / RUNNING / COMPLETED / FAILED
  SUBMITTED -> RUNNING / UNKNOWN / COMPLETED / FAILED
  RUNNING -> UNKNOWN / COMPLETED / FAILED
  COMPLETED and FAILED are terminal

MediaAsset bytes lifecycle:
  VALIDATING -> READY / REJECTED

FinalArtifact:
  PENDING -> READY / FAILED -> ARCHIVED
```

`ProviderOperation.COMPLETED` requires canonical normalized result + result fingerprint. Persist provider completion before materialization. Mark a stage/job complete only after durable object upload and PostgreSQL metadata commit.

## 10. Implementation sequence

Dependencies are sequential unless a task explicitly states otherwise. Complete tests and update this plan before starting the next task.

### Task 1: Freeze contracts, ADR and migration

**Files:**

- Create: `documentation/decisions/ADR-0017-mvp-image-review-render-boundary.md`
- Modify: `app/backend-service/src/main/resources/db/migration/V1__initial_schema.sql`
- Modify: `app/backend-service/src/main/resources/db/migration/V2__seed_demo_data.sql`
- Modify if payload changes are required: `contracts/job-event.v1.schema.json`
- Modify: `documentation/workflows/IMAGE_GENERATION.md`
- Modify: `documentation/workflows/STORY_TO_VIDEO.md`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/MediaGenerationMigrationIntegrationTest.java`

- [ ] record the two-command boundary, execution/review split, lineage/dedup behavior and provider capability gate in ADR-0017
- [ ] confirm canonical enum values against existing SQL/Java; do not add aliases such as `CANCELLED`
- [ ] fold the additive execution/review contract into V1 with constraints, partial indexes and immutability rules
- [ ] update job-event payload only if the dispatcher consumes new plan/item identifiers; existing job/resource enums already include the required values
- [ ] add fresh/upgrade/constraint/immutability PostgreSQL tests
- [ ] run the focused migration tests; all must pass before Task 2

### Task 2: Make `MediaPlan` an executable immutable snapshot

**Files:**

- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/port/in/MediaPlanningSource.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/service/MediaPlanningSourceService.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/aggregate/MediaPlan.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/value/MediaBeatPlan.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaPlanUseCase.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/MediaPlanRow.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/MediaBeatPlanRow.java`
- Modify: `app/backend-service/src/main/resources/mybatis/MediaPlanMapper.xml`
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaPlanUseCaseTest.java`
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/domain/aggregate/MediaPlanTest.java`

- [ ] read only the Chapter's current storyboard revision and include only required approved VisualBeats plus their participating character context
- [ ] resolve current READY narration set/alignment run and map exact ordered audio spans
- [ ] build prompt-safe provider input from visual intent + participating approved character/reference snapshots; keep untrusted content distinct from system instructions
- [ ] snapshot project/default aspect, quality, backend-resolved provider/model, workflow/pricing versions and fingerprints
- [ ] enforce `GENERATE_NEW` + `IMAGE_MOTION`; reject unsupported strategy instead of downgrading or selecting mock data
- [ ] calculate workload/cost from actual beat count, resolution/quality and bounded attempts; do not use fixed image count or duration
- [ ] test stale revision/hash, empty/unapproved beats, invalid/missing audio spans, missing character lock/consent, unsupported strategy and immutable replay
- [ ] run focused domain/use-case/persistence tests before Task 3

### Task 3: Add media admission and read APIs

**Files:**

- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/request/CreateMediaJobRequest.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/response/MediaJobDetailsResponse.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/command/CreateMediaJobCommand.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaJobUseCase.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/entity/MediaGenerationItem.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/enums/MediaGenerationExecutionStatus.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/enums/MediaGenerationReviewStatus.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/port/out/MediaGenerationItemRepository.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/MediaGenerationItemRow.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/MediaGenerationItemMapper.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/adapter/MyBatisMediaGenerationItemPersistenceAdapter.java`
- Create: `app/backend-service/src/main/resources/mybatis/MediaGenerationItemMapper.xml`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/controller/MediaGenerationController.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/controller/ProjectGenerationController.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/response/JobResponse.java`
- Modify: `app/backend-service/src/main/resources/mybatis/GenerationJobMapper.xml`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaJobUseCaseTest.java`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/api/MediaGenerationControllerContractTest.java`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/MediaGenerationItemRepositoryIntegrationTest.java`

- [ ] require session identity, CSRF and `Idempotency-Key`; reject cross-account/project access without accepting identity headers
- [ ] enforce Definition of Ready, server entitlement/abuse/concurrency/quota and `maxAuthorizedCost`
- [ ] in one transaction persist MediaPlan, OperationPlan, reservation, GenerationJob, StageAttempt, per-beat items and outbox
- [ ] use a canonical request fingerprint; implement replay versus `409 IDEMPOTENCY_CONFLICT`
- [ ] add generic job response fields additively and add ownership-scoped media details query
- [ ] test 202, replay, conflict, cost/quota/entitlement denial, stale source, not-ready inputs, ownership, CSRF/auth and transaction rollback
- [ ] run focused backend API/application/integration tests before Task 4

### Task 4: Generalize worker dispatch and durable provider result persistence

**Files:**

- Modify: `app/ai-worker/src/narrativex_worker/worker.py`
- Modify: `app/ai-worker/src/narrativex_worker/repository.py`
- Modify: `app/ai-worker/src/narrativex_worker/providers/ports.py`
- Modify: `app/ai-worker/src/narrativex_worker/schema.py`
- Create: `app/ai-worker/src/narrativex_worker/job_dispatch.py`
- Create: `app/ai-worker/src/narrativex_worker/storage.py`
- Modify as compatibility wrapper: `app/ai-worker/src/narrativex_worker/narration/storage.py`
- Modify: `app/ai-worker/tests/test_worker.py`
- Modify: `app/ai-worker/tests/test_repository_postgres.py`
- Modify: `app/ai-worker/tests/test_provider_result_immutability_postgres.py`
- Create: `app/ai-worker/tests/test_job_dispatch.py`
- Create: `app/ai-worker/tests/test_storage.py`

- [ ] change the claim result from Chapter-analysis-specific data to a generic stage envelope routed by `job_type` + `stage_name`
- [ ] preserve existing `CHAPTER_ANALYZE` behavior and add handler registration for `CHAPTER_GENERATE` and `CHAPTER_RENDER`
- [ ] make durable normalized provider result generic/canonical JSON instead of `ChapterAnalysisResult`-only while retaining typed reconstruction inside each handler
- [ ] keep row-version CAS, lease ownership, heartbeat, pre-submit `UNKNOWN` fence and completed-result immutability unchanged
- [ ] extract the existing generic R2 `MediaStorage` to a shared module without breaking narration imports
- [ ] fail unsupported job types without claiming them and prevent two handlers from claiming the same stage
- [ ] test analysis regression, routing, unknown job type, lease loss, handler crash, generic result replay/conflict and shared storage behavior
- [ ] run worker unit + PostgreSQL tests, Ruff and mypy before Task 5

### Task 5: Implement image contracts, validation and first provider adapter

**Files:**

- Modify: `app/ai-worker/src/narrativex_worker/media.py`
- Modify: `app/ai-worker/src/narrativex_worker/providers/ports.py`
- Create: `app/ai-worker/src/narrativex_worker/providers/image.py`
- Create: `app/ai-worker/src/narrativex_worker/providers/vertex_image.py`
- Create: `app/ai-worker/src/narrativex_worker/media_validation.py`
- Modify: `app/ai-worker/src/narrativex_worker/config.py`
- Modify: `app/ai-worker/src/narrativex_worker/providers/__init__.py`
- Modify: `app/ai-worker/.env.example`, `.env.example`, `docker-compose.yml`
- Create: `app/ai-worker/tests/test_image_provider.py`
- Create: `app/ai-worker/tests/test_vertex_image_provider.py`
- Create: `app/ai-worker/tests/test_media_validation.py`
- Create: `app/ai-worker/tests/test_provider_factory.py`
- Modify: `app/ai-worker/tests/test_config.py`

- [ ] define strict provider-neutral request/result/operation/capability/billing models; no vendor SDK types outside adapter
- [ ] implement configured Vertex image adapter using ADC/workload identity and server-resolved model/location
- [ ] compute stable request fingerprint from plan + beat snapshot + prompt/settings + provider/model/workflow version
- [ ] normalize base64/object-reference output into a bounded acquisition contract; never place image bytes/base64 in `normalized_result_json`
- [ ] validate schema, decoded content, MIME allowlist, byte limit, positive dimensions, aspect policy and SHA-256
- [ ] normalize moderation to `SAFE`, `REVIEW`, `BLOCK`; blocked output cannot become an asset usable by render
- [ ] classify definitive rejection separately from ambiguous submission and implement the capability-gated reconciliation behavior from section 6
- [ ] keep disabled/misconfigured provider fail-closed; deterministic fakes exist only in tests
- [ ] test 2xx, definitive 4xx, rate limit, timeout, ambiguous 5xx, invalid JSON/base64, oversized/corrupt image, unsafe output and capability mismatch
- [ ] run focused pytest, Ruff and mypy before Task 6

### Task 6: Execute and materialize per-beat image generation

**Files:**

- Create: `app/ai-worker/src/narrativex_worker/image_generation_runner.py`
- Create: `app/ai-worker/src/narrativex_worker/media_repository.py`
- Modify: `app/ai-worker/src/narrativex_worker/job_dispatch.py`
- Modify: `app/ai-worker/src/narrativex_worker/worker.py`
- Create: `app/ai-worker/tests/test_image_generation_runner.py`
- Create: `app/ai-worker/tests/test_media_generation_recovery.py`
- Create: `app/ai-worker/tests/test_media_generation_repository_postgres.py`

- [ ] load the exact immutable plan revision and fail stale/missing/corrupt snapshots before submission
- [ ] process items with configured bounded concurrency and lease-safe progress updates
- [ ] reserve/reuse one ProviderOperation per stable item request fingerprint before external submission
- [ ] reconcile due `UNKNOWN`/`SUBMITTED`/`RUNNING` operations before considering new work; never blind-resubmit
- [ ] acquire returned bytes with strict bounds, write/reuse a private immutable R2 result object, then persist `ProviderOperation.COMPLETED` with internal object identity + SHA-256
- [ ] replay from that durable result object, fully validate/moderate, then transactionally insert/reuse `MediaAsset` + insert lineage + update item without copying bytes unnecessarily
- [ ] make R2/DB failures replayable from durable provider result and verify an existing object by SHA-256 before reuse
- [ ] preserve successful items and immutable failed attempts; do not overwrite a VisualBeat's historical asset
- [ ] derive parent job progress/status deterministically from required item states
- [ ] test full success, partial definitive failure, ambiguous submission, crash before/after provider completion, lease loss, duplicate worker, R2 conflict, DB rollback, moderation block and replay
- [ ] run focused worker/PostgreSQL tests, then full worker checks before Task 7

### Task 7: Add generated-asset review and authorized delivery

**Files:**

- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/api/controller/AssetLibraryController.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/application/usecase/AssetLibraryUseCase.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/request/ReviewMediaGenerationItemRequest.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/ReviewMediaGenerationItemUseCase.java`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/application/usecase/GetMediaAssetUseCase.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/infrastructure/persistence/mybatis/MediaAssetMapper.java`
- Modify: `app/backend-service/src/main/resources/mybatis/MediaAssetMapper.xml`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/ReviewMediaGenerationItemUseCaseTest.java`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/assets/api/GeneratedAssetDeliveryContractTest.java`

- [ ] add owner-scoped single asset metadata and short-lived signed download behavior
- [ ] authorize generated assets through account identity and project/chapter lineage without exposing storage keys
- [ ] add item review transition `NEEDS_REVIEW -> APPROVED|REJECTED` with row version and immutable audit fields
- [ ] require a new admitted attempt for regeneration; never mutate prior request/result/asset lineage
- [ ] test cross-account access, missing/deleted/rejected asset, stale review version, duplicate same decision, conflicting decision and signing failure
- [ ] run focused backend asset/generation tests before Task 8

### Task 8: Implement exact-input IMAGE_MOTION rendering

**Files:**

- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/request/CreateChapterRenderRequest.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/command/CreateChapterRenderCommand.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateChapterRenderUseCase.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/render/api/controller/FinalArtifactController.java`
- Create: `app/ai-worker/src/narrativex_worker/rendering/__init__.py`
- Create: `app/ai-worker/src/narrativex_worker/rendering/image_motion.py`
- Create: `app/ai-worker/src/narrativex_worker/rendering/ffmpeg.py`
- Create: `app/ai-worker/src/narrativex_worker/rendering/validation.py`
- Create: `app/ai-worker/src/narrativex_worker/render_runner.py`
- Modify: `app/ai-worker/src/narrativex_worker/job_dispatch.py`
- Modify: `app/ai-worker/src/narrativex_worker/media_repository.py`
- Modify: backend render repository implementations under `app/backend-service/src/main/java/com/narrativex/backend/feature/render`
- Create: `app/ai-worker/tests/test_image_motion_render.py`
- Create: `app/ai-worker/tests/test_ffmpeg_validation.py`
- Create: `app/ai-worker/tests/test_final_artifact_persistence.py`
- Create/modify focused backend render admission and artifact delivery tests

- [ ] require `Idempotency-Key`, exact plan revision, all required item reviews approved, READY narration and renderer capability
- [ ] replace fixed render estimate with profile/version-based estimate and server reservation
- [ ] persist immutable render manifest and job admission atomically; same fingerprint reuses existing manifest/artifact/job
- [ ] download only manifest-listed private R2 inputs into bounded scratch and verify size/SHA-256
- [ ] invoke `ffmpeg`/`ffprobe` with argument arrays and fixed filter construction; never concatenate untrusted strings into a shell
- [ ] use ordered narration spans as duration authority and map persisted camera movement to deterministic bounded transforms
- [ ] validate output container/MIME, width, height, duration tolerance, fps, audio stream, size and SHA-256
- [ ] upload/reuse immutable MP4, persist FinalArtifact, finish signed `/api/v1/artifacts/{id}/download`, settle usage and clean scratch
- [ ] test not-ready inputs, stale plan, duplicate admission, corrupt/missing object, checksum mismatch, FFmpeg failure/timeout, duration mismatch, scratch loss and successful artifact replay
- [ ] run focused backend/worker render tests with tiny generated fixtures before Task 9

### Task 9: Wire the real frontend flow and verify in browser

**Files:**

- Modify: `app/frontend-web/src/types/api.ts`
- Modify: `app/frontend-web/src/types/assets.ts`
- Modify: `app/frontend-web/src/lib/query-keys.ts`
- Create: `app/frontend-web/src/features/generation/api/media.api.ts`
- Create: `app/frontend-web/src/features/generation/hooks/useMediaGeneration.ts`
- Create: `app/frontend-web/src/features/generation/components/GenerateMediaModal.tsx`
- Create: `app/frontend-web/src/features/chapters/components/ChapterVisualsTab.tsx`
- Create: `app/frontend-web/src/features/chapters/components/ChapterRenderTab.tsx`
- Modify: `app/frontend-web/src/features/chapters/hooks/useChapterWorkspaceState.ts`
- Modify: `app/frontend-web/src/features/chapters/components/ChapterWorkspaceTabs.tsx`
- Replace or retire placeholder data paths in `VisualReview.tsx` and `Render.tsx`
- Modify `globals.css`/`tailwind.config.ts` only when a missing semantic token is required
- Create: `app/frontend-web/e2e/media-generation.smoke.spec.ts`

- [ ] add runtime guards for new API responses and additive job fields
- [ ] expose tabs from backend capability/readiness data, not a hardcoded runtime mock flag
- [ ] create modal for aspect/quality/cost confirmation and generate a stable idempotency key per user intent
- [ ] render global job and ordered per-beat execution/review states, including `UNKNOWN`, `STALLED`, `PAUSED_COST_LIMIT`, failures and actionable blocking reasons
- [ ] approve/reject with optimistic row version; require explicit new paid action for regeneration
- [ ] enable render only when backend reports exact prerequisites ready; preview/download only via authorized backend URL
- [ ] remove runtime Unsplash/demo fallbacks and fixed scene/visual/duration counts from affected flow
- [ ] use centralized semantic tokens only; no new hardcoded JSX/TSX hex colors
- [ ] add Playwright real-backend flow without `waitForTimeout`; credentials remain out-of-band
- [ ] run `npm run test`, lint, type-check, build and Playwright
- [ ] start/reuse dev server, exercise every affected screen, inspect console/network/loading/error/empty/overflow states and capture screenshot evidence

### Task 10: Operational hardening, documentation and release gate

**Files:**

- Create: `documentation/workflows/MEDIA_GENERATION_OPERATIONS.md`
- Modify: `documentation/codebase/AI_WORKER_CODEBASE.md`
- Modify: `documentation/codebase/BACKEND_CODEBASE.md`
- Modify: `documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md`
- Modify: `documentation/product/PRODUCT_SPEC.md` and `documentation/product/ROADMAP.md` only where capability status changes
- Modify this plan as progress/scope changes

- [ ] add structured IDs to logs/metrics while redacting prompts, signed/provider URLs, secrets and raw payloads
- [ ] expose truthful image-provider, R2 and FFmpeg capability health; deterministic fake success never counts as production health
- [ ] verify reservation consume/release and actual usage cannot double-settle or go negative
- [ ] add bounded retry/reconcile schedules, rate/concurrency/abuse controls and operator handling for unreconcilable `UNKNOWN`
- [ ] document retention/deletion/orphan-object reconciliation and real-person reference deletion propagation
- [ ] update implementation-facing docs to mark IMAGE_MOTION MVP implemented and I2V/reuse deferred
- [ ] run secret scan/documentation drift checks and all release commands in section 15
- [ ] complete the manual/staging evidence in section 16

## 11. Testing strategy

### Backend

- Domain tests for immutable snapshot, timing, workload, review transitions and render readiness.
- Application tests with fakes for ownership, admission, idempotency, entitlement, cost/reservation and stale input.
- PostgreSQL integration tests for V7, unique/check/FK/partial indexes, CAS, outbox, lineage, manifest and artifact replay.
- Controller contract tests for JSON, validation, auth, CSRF, safe error codes and no storage/provider leakage.
- Architecture tests keep provider SDKs out of backend domain/application and reject client-controlled identity headers.

### Worker

- `httpx.MockTransport` for adapter behavior; no paid network dependency in default CI.
- Deterministic fake provider only in tests; opt-in real-provider smoke test is separate and explicitly charged.
- Small generated PNG/JPEG/MP4 fixtures for decode/probe/checksum validation.
- PostgreSQL tests for claim/lease/heartbeat, provider fence, generic result replay, per-item state derivation and crash recovery.
- Ruff + strict mypy + pytest after each worker task.

### Frontend

- Runtime contract guards and API mapping/status tests.
- Playwright against real backend/session/CSRF with out-of-band test credentials.
- Web-first assertions and event-driven waits only; no arbitrary sleeps.
- Mandatory visual/browser verification and screenshots for Generate, Visual review, Render and Artifact states.

## 12. Security and abuse test matrix

- Cross-account project, job, item, asset and artifact access.
- Missing/invalid CSRF and unauthenticated expensive commands.
- Client attempts to send identity, provider, model, storage key, signed URL or excessive cost/size values.
- Prompt/reference/provider output size limits and malformed media.
- SSRF-safe handling if a provider returns a URL: HTTPS + provider-owned allowlist or provider-native authenticated fetch, redirect/size/time limits.
- Real-person reference without consent, revoked consent and deletion request.
- Concurrent idempotency requests, stale row versions, lease stealing and duplicate materialization.
- Logs/responses verified free of secrets, raw signed URLs and unrestricted prompt/provider payloads.

## 13. Failure and recovery semantics

| Failure point | Durable state | Recovery |
| --- | --- | --- |
| Before provider fence | `ProviderOperation.RESERVED` | Safe to submit once after lease recovery |
| Timeout/crash after fence, no operation ID | `UNKNOWN`, no blind retry | Provider/request-key reconciliation if supported; otherwise operator resolution |
| Provider completed, result not materialized | `COMPLETED` + normalized result fingerprint | Replay validation/R2/DB materialization |
| R2 object exists, DB write failed | Completed provider op + checksum-stable object | Verify object metadata/checksum, then retry DB transaction |
| Asset persisted, item update failed | Asset + lineage/queryable request fingerprint | Reconcile item idempotently without provider call |
| FFmpeg/scratch failure | Render job/stage failed or safely retryable before external paid work | Rebuild scratch from exact manifest inputs |
| MP4 uploaded, artifact write failed | Checksum-stable render object + manifest fingerprint | Verify/reuse object, persist artifact idempotently |

## 14. Definition of Done

MVP is done only when all statements are true:

1. A reviewed Chapter with READY narration can create a real `CHAPTER_GENERATE` job through UI/API.
2. Admission persists the complete server authorization boundary before external submission.
3. A configured real image adapter generates validated output; disabled/misconfigured mode fails explicitly.
4. Every successful beat has durable immutable R2 bytes, READY `MediaAsset`, exact lineage and separate review state.
5. Ambiguous submission becomes `UNKNOWN` and never blind-resubmits.
6. `IMAGE_MOTION` creates no I2V provider operation.
7. Only approved exact-plan inputs can enter a render manifest.
8. FFmpeg produces a validated narration-timed MP4 and replay after scratch loss does not regenerate images.
9. Artifact metadata/preview/download are owner-authorized and reveal no storage key/provider URL.
10. Entitlement, watermark, cost, quota, concurrency, reservation and usage are server-authoritative and idempotent.
11. Backend, worker and frontend automated checks pass.
12. Mandatory browser flow passes with screenshot evidence and no blocking console/network errors or runtime mock data.

## 15. Verification commands

Run focused tests after each task, then the full gate:

```powershell
cd app/backend-service
./mvnw.cmd test

cd ../ai-worker
python -m pytest
python -m ruff check .
python -m mypy src

cd ../frontend-web
npm run test
npm run lint
npm run type-check
npm run build
npm run test:e2e
```

`npm ci` is an environment/bootstrap action, not a required step on every local verification run when the lockfile installation is already current.

## 16. Staging/manual acceptance evidence

- Real provider smoke job using non-secret test content with recorded job/plan/item IDs and redacted provider operation metadata.
- PostgreSQL evidence for MediaPlan, OperationPlan, reservation, GenerationJob, StageAttempt, ProviderOperation, items, MediaAsset, lineage, render manifest and FinalArtifact.
- R2 evidence for immutable images and final MP4, including SHA-256 match; no local scratch path is used for delivery.
- Forced ambiguous provider scenario showing `UNKNOWN` and zero duplicate submissions.
- Forced worker restart after provider completion showing result/materialization replay.
- Final MP4 duration, resolution, fps and audio-stream probe evidence.
- Authorized owner preview/download success and cross-owner denial.
- Browser screenshots plus console/network inspection for loading, active, review, error/unknown, render-ready and completed artifact states.

Do not place credentials, signed URLs, raw prompts or provider response bodies in evidence artifacts.

## 17. External/operator actions

These are not repository checkboxes and require environment owners:

- Provision provider project/credentials/quota and choose the endpoint that satisfies section 6.
- Configure private R2 bucket, lifecycle, CORS where required, credentials and signed URL TTL.
- Pin an FFmpeg/ffprobe version in the worker runtime image and set CPU/memory/scratch/concurrency limits.
- Configure staging budget/rate alerts and run the opt-in paid smoke test.
- Approve retention, moderation and real-person consent policies for generated media.

## 18. Fast-follow after MVP

Create a separate plan after this Definition of Done is met:

- reuse/reframe/edit AssetResolver;
- Character/reference locking UX expansion;
- `HYBRID_LOCAL_I2V` + Wan runner, benchmark-based GPU pricing and deterministic fallback;
- full Project/Short render, subtitle pipeline and batch generation;
- advanced identity QA and provider marketplace.

## 19. Progress tracking

- Mark `[x]` immediately when a task and its tests pass.
- Add `[+]` for discovered in-scope work and `[!]` for evidence-backed blockers.
- Update ADR/workflow/API docs before implementing a changed boundary.
- Do not mark Task 9 complete without browser verification and screenshot evidence.
- When every Definition of Done item is satisfied, move this plan to `documentation/plans/completed/`.

### 2026-08-21 implementation update

- `[x]` Consolidated persistence contract, executable MediaPlan snapshots, media-generation items and asset-lineage schema.
- `[x]` Backend `CHAPTER_GENERATE` admission, cost/quota reservation, idempotency conflict handling, status/review APIs and pinned render inputs.
- `[x]` Provider-neutral worker image contracts, Vertex capability gate, bounded image validation, UNKNOWN/no-blind-resubmit runner contract and deterministic IMAGE_MOTION FFmpeg modules.
- `[x]` Frontend Visuals/Render tabs, real API polling, review actions and capability-driven rendering controls.
- `[x]` Backend compile, focused regression tests, worker pytest/mypy/ruff, frontend type-check/lint/architecture checks.
- `[!]` Mandatory Chapter browser flow is blocked at authentication in the available browser session; no test credentials were entered. Screenshot evidence currently covers the login boundary only.
- `[!]` Worker dispatcher-to-PostgreSQL materialization and configured-provider paid smoke evidence remain environment/integration work; the worker modules are documented as contracts until wired into the existing dispatcher.
- `[!]` Final server-side render admission still needs to validate the complete approved item set and materialize the exact render manifest; the frontend currently applies the readiness/review gate as a UX guard.
