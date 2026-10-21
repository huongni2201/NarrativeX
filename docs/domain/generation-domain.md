# Generation Domain

Take validation metadata and the QA taxonomy. Decisions: [ADR-0008](../decisions/ADR-0008-video-first-shot-production.md). Wire contract: [Compute Protocol](../architecture/compute-protocol.md).

## Three separate layers

A Take carries three independent judgements. None may stand in for another.

| Layer | Source | Effect |
|---|---|---|
| **Technical validation** | Backend finalizer on worker evidence (observed duration, 720p24 streams, audio stream, full decode) | Sets `validation_status` PASSED/FAILED. Required before a Take can be selected. |
| **Automatic QC (tier 1)** | Worker measurements (`qualityMetrics`), evaluated on read against `TAKE_QC_THRESHOLDS_V1` | Advisory only: GOOD, REVIEW, DEFECT or UNMEASURED. Never changes validation, blocks selection or submits a job. |
| **Human review** | Editor checklist at selection time | Required to create or change a SelectedTake. |

Missing or unavailable measurements read as UNMEASURED, never as a pass. Checks tier 1 does not perform (face similarity, lip-sync, hand/face deformation) are shown as "chưa đo".

## Failure taxonomy

`VideoQAFailureCategory` has eleven categories: `FACE_IDENTITY`, `CHARACTER_CONSISTENCY`, `ANATOMY`, `MOTION`, `TEMPORAL_ARTIFACT`, `CAMERA`, `COMPOSITION`, `PROMPT_ADHERENCE`, `CONTINUITY`, `DURATION`, `TECHNICAL_OUTPUT`. Technical validation currently emits `TECHNICAL_OUTPUT`; automatic QC warnings map into `MOTION`, `TEMPORAL_ARTIFACT`, `TECHNICAL_OUTPUT`, `DURATION` and `CONTINUITY`.

`VideoQualityAssurance` turns a detected failure into a reason-aware retry recommendation and escalates to manual review after `MAX_AUTOMATED_RETRIES` (3). A recommendation is text for the editor; it does not create a job.

## Where measurements live

- Take row: `takes.metrics_json`. WhisperX evidence sits under `whisperx`; automatic QC under `qualityControl` (written with `jsonb_set`, so keys do not overwrite each other).
- Worker scorer: `FFMPEG_TAKE_QC_V1` (freeze head/total, motion, scene cuts, flicker, black, silence, LUFS, peak, mean YUV).
- Read model: `ChapterProductionView.ProductionTakeItem.quality` (level, thresholds version, warnings, raw metrics).
- Thresholds not fixed by the plan (motion, flicker, color drift) are uncalibrated starting values until measured against labelled takes.

## Not in scope

Automatic regeneration of defective Takes, semantic QA loops and post-publish feedback are not part of the current architecture and need their own decision (ADR-0008, items 10–11).

## Related

[Shot domain](shot-domain.md) · [Domain model](domain-model.md)
