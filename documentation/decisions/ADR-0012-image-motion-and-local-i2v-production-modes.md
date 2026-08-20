# ADR-0012: Image-motion and local-I2V production modes

- Status: Accepted
- Date: 2026-08-20
- Decision owners: NarrativeX backend, worker and frontend maintainers

## Context

NarrativeX is an image-first long-form story-video product. Generating every visual beat with a commercial video provider makes long-form unit economics poor and is unnecessary for exposition, inner monologue, reaction, system/UI and many dialogue beats. The existing `VisualBeat.motionMode` already separates deterministic `BASIC_MOTION` from `AI_VIDEO`, but the product also needs a project/render-level policy that controls whether AI video is allowed at all.

Narration is generated from persisted Chapter source. For source-preserving narration, the full original Chapter text must remain unchanged and the narration timeline must drive visual timing. Visual duration therefore cannot be modeled as a fixed sentence/image duration.

## Decision

NarrativeX supports two provider-neutral production modes:

- `IMAGE_MOTION`: keyframes plus deterministic motion/editing only. Paid or GPU-heavy I2V is not authorized.
- `HYBRID_LOCAL_I2V`: the same image-first workflow, with selected medium/complex beats eligible for a private/self-hosted I2V route. The initial adapter targets a Wan2.2-compatible HTTP inference endpoint.

The production mode is not a provider enum. Existing per-beat `motionMode` remains the render strategy. The planning layer classifies motion complexity (`SIMPLE`, `MEDIUM`, `COMPLEX`) and resolves a planned strategy:

```text
IMAGE_MOTION
  -> every beat BASIC_IMAGE_MOTION

HYBRID_LOCAL_I2V
  -> SIMPLE          BASIC_IMAGE_MOTION
  -> MEDIUM          IMAGE_TO_VIDEO when authorized
  -> COMPLEX         IMAGE_TO_VIDEO when authorized
  -> unavailable / over-budget / rejected route
                     BASIC_IMAGE_MOTION fallback when policy allows
```

Before new image generation the planner resolves assets in this order:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

Derived assets preserve source lineage.

The worker owns the I2V runtime adapter, but PostgreSQL-backed `OperationPlan`, reservation, `StageAttempt` and `ProviderOperation` remain durable authority. A local GPU endpoint is treated as an external execution boundary: persist reservation/provider intent before submission; ambiguous POST outcomes become `UNKNOWN`; reconciliation queries by provider operation id or idempotent request id before any resubmit.

The Wan endpoint is configured infrastructure, not a new NarrativeX domain service. Provider/model-specific code stays behind `VideoGenerationProvider`.

## Audio-first planning

For source-preserving narration:

```text
persisted Chapter source
  -> TTS full Chapter text
  -> narration asset + alignment timestamps
  -> adaptive visual-scene plan
  -> visual/motion generation
  -> Chapter render
```

Visual scenes reference source-text spans and audio spans. A five-second generated motion clip may be deterministically extended inside a longer narration span; billable I2V duration and timeline duration are separate properties.

## Cost planning

Story semantic analysis produces workload, not a hardcoded vendor price. Cost authority combines the planned workload with versioned pricing/benchmark snapshots.

For local I2V, cost is estimated from measured GPU compute rather than a fictional fixed cost per scene:

```text
expectedGpuSeconds
  = plannedI2vOutputSeconds
  * benchmarkMedianGpuSecondsPerOutputSecond
  * expectedAttemptFactor

expectedI2vCost
  = expectedGpuSeconds / 3600
  * gpuUsdPerHour
```

The reservation ceiling uses a bounded/p90 benchmark and maximum authorized attempts. `expectedCost`, `reservationCeiling` and reconciled `actualCost` remain distinct.

Changing production mode, I2V share, I2V resolution or cost ceiling re-plans/re-prices the same valid semantic analysis snapshot. It does not require story re-analysis unless source or analysis-relevant inputs changed.

## Consequences

- Long-form video has a low-cost mode that never requires generative video.
- AI motion can be concentrated on scenes where it materially improves quality.
- Commercial video providers are optional future adapters, not architectural dependencies.
- Local GPU economics are benchmark-driven and can be recalculated when hardware/model settings change.
- Worker code cannot silently upgrade a deterministic scene to I2V outside the authorized operation plan.
- The first code slice adds planning contracts and a Wan-compatible adapter; end-to-end TTS/media planning, durable media job wiring, cost authority and render UI remain separate implementation slices and must not be reported as already complete.
