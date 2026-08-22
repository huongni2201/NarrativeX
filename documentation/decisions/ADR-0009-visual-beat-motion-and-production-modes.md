# ADR-0009: VisualBeat motion model, local I2V and production modes

- Status: Accepted
- Date: 2026-08-19 (consolidated and updated: 2026-08-21)
- Scope: VisualBeat domain motion properties, deterministic vs generative rendering policies, local Wan I2V integration, and GPU-based cost estimation.
- Consolidated from: former ADR-0009 and ADR-0012 (modes).

## Context

NarrativeX is an image-first, long-form story-to-video platform. Generating every single visual beat using external generative video APIs (I2V) makes long-form unit economics unfeasible and is unnecessary for exposition, dialogue, reaction shots, and environmental beats.

The domain needs a clean separation between camera motion and the rendering mode, along with project-level production modes that govern when generative AI video is authorized versus deterministic keyframe motion.

## Decision

### 1. Separate Motion Mode and Camera Movement

On `VisualBeat`, the system persists two independent fields:
- **`motion_mode` (Rendering Strategy):** `STILL`, `BASIC_MOTION`, `AI_VIDEO`.
- **`camera_movement` (Camera Direction):** `NONE`, `PAN`, `TILT`, `PUSH_IN`, `PULL_OUT`, `TRACK`, `ZOOM_IN`, `ZOOM_OUT`, `PARALLAX`.
- `review_status` remains a distinct review flag.

### 2. Provider-Neutral Production Modes

- **`IMAGE_MOTION` Mode:** Keyframes with deterministic motion/panning/zooming only. Generative I2V is never invoked.
- **`HYBRID_LOCAL_I2V` Mode:** Image-first baseline where the planner classifies beats by complexity (`SIMPLE`, `MEDIUM`, `COMPLEX`). Medium/Complex beats can be routed to a local self-hosted I2V endpoint (e.g. Wan2.2) when authorized by budget policy.

```text
IMAGE_MOTION
  -> All beats: BASIC_MOTION

HYBRID_LOCAL_I2V
  -> SIMPLE:    BASIC_MOTION
  -> MEDIUM:    AI_VIDEO (if authorized) -> fallback BASIC_MOTION
  -> COMPLEX:   AI_VIDEO (if authorized) -> fallback BASIC_MOTION
```

### 3. Asset Lineage and Planning Order

Before generating a new image, the visual planner resolves assets in priority order:
1. `REUSE_APPROVED`
2. `REFRAME_DERIVED`
3. `EDIT_EXISTING`
4. `GENERATE_NEW`

### 4. Style Preset and Voice Catalog Boundaries

- Style presets and voice catalog entries are persisted in PostgreSQL and exposed via read-only endpoints (`/api/v1/style-presets`, `/api/v1/voices`).
- Public catalog responses serialize display fields only (`name`, `description`, `thumbnail`, `tags`). Prompt templates, provider parameters, and internal generation policies remain internal application data.

### 5. Two-Command Media Boundary & Execution vs Review Separation

The MVP media pipeline enforces two distinct commands:
1. `CHAPTER_GENERATE`: Creates keyframe generation items per approved `VisualBeat` in an immutable `MediaPlan` revision. Execution status is tracked per beat in `media_generation_items`.
2. `CHAPTER_RENDER`: Admitted only after all required visual items are explicitly `APPROVED` and narration is ready. It creates an immutable `render_manifests` record containing exact asset IDs and audio alignment, producing `final_artifacts`. The worker executes deterministic `IMAGE_MOTION` FFmpeg rendering.

Execution and human review are strictly separate state machines:
- Validated byte uploads produce `READY` in `media_assets` while the associated `media_generation_items` row remains `NEEDS_REVIEW`.
- Only `APPROVED` items can be included in a render manifest.
- Checksum deduplication may reuse canonical `media_assets` rows, but each logical beat maintains its own insert-only `media_asset_lineage` record.

### 6. GPU Compute Cost Estimation & Provider Capability Gates

For local I2V, cost estimation is derived from empirical GPU execution benchmarks rather than arbitrary per-scene pricing:

```text
expectedGpuSeconds = plannedI2vOutputSeconds * benchmarkMedianGpuSecondsPerOutputSecond * expectedAttemptFactor
expectedI2vCost    = (expectedGpuSeconds / 3600) * gpuUsdPerHour
```

The reservation ceiling uses a p90 benchmark with maximum allowed attempts.

External provider adapters (e.g. Vertex image generation) require verified endpoint configuration, pricing snapshots, safety signal handling, and operation reconciliation support before activation. Ambiguous provider network outcomes transition to `UNKNOWN` and are never automatically resubmitted.

## Invariants

1. `motion_mode` and `camera_movement` are distinct enum fields validated in SQL.
2. In `IMAGE_MOTION` mode, no generative I2V provider calls are ever initiated.
3. Image generation never implicitly triggers video rendering; human review and explicit render admission are required.
4. Render manifests and final artifacts are immutable once created.
5. Local Wan endpoints are treated as external execution boundaries requiring PostgreSQL pre-submit reservation and CAS status transitions.
6. Changing production modes re-prices and re-plans the storyboard without requiring story text re-analysis.

## Consequences

- Cost-effective long-form production with deterministic budgeting.
- High-impact scenes leverage generative video while maintaining low average cost per minute.
- Worker restarts replay durable provider results without initiating redundant paid provider calls.
- Private Wan2.2 deployment serves as an infrastructure adapter behind `VideoGenerationProvider`.
