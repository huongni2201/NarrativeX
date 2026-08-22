# NarrativeX — Product Specification V1.11

**Status:** maintained product contract  
**Canonical source:** [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md)  
**Implementation evidence:** [`../TRACEABILITY.md`](../TRACEABILITY.md)

ADR-0012 governs R2 pipeline media. ADR-0016 governs final rendered MP4 storage in Google Drive.

## Product definition

NarrativeX is an AI-assisted long-form story-video studio. It is chapter-first, review-first, audio-timeline-first, image-first, backend-authorized and durable-by-design.

Project creation is metadata-only. Saving Chapter source does not implicitly run AI. Analysis, narration selection/processing, image generation and rendering are explicit operations.

## Current implementation snapshot

Implemented foundations include:

- Project/StoryVersion/Chapter authoring, dashboard/favorite and project-scoped reads;
- MyBatis + explicit SQL for production persistence and durable generation execution;
- durable Chapter Analyze and provider-operation reconciliation;
- Character/Location continuity and Scene/VisualBeat materialization;
- backend-authoritative MediaPlan/job pinning;
- Google TTS and local VieNeu narration with R2-backed final narration audio;
- `USER_PROVIDED_AUDIO` ordered-part/global-clock/TTS-bypass planning foundations;
- real Vertex image generation with validated R2-backed images;
- dedicated deterministic `IMAGE_MOTION` chapter render through FFmpeg + ffprobe;
- Google Drive resumable final-video upload and provider-aware FinalArtifact metadata;
- final rendered MP4 is not duplicated into R2 by default.

The complete multi-Chapter uploaded-audio → render loop is not yet implemented because the current renderer loads matching generated narration and does not slice/stitch aligned uploaded-audio parts.

## Narration contract

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

`USER_PROVIDED_AUDIO` is not one-file-per-Chapter. One file may cover many Chapters or several ordered files may cover one selected range. NarrativeX models one logical audio clock and aligns source spans to that timeline. TTS generation/reservation is omitted for the covered scope.

Generated narration and accepted uploaded audio remain R2-backed pipeline media.

## Media planning contract

The backend owns the authorized immutable `MediaPlan` and resolved `MotionStrategy`. The worker executes persisted policy and may only fall back within authorization.

```text
ProductionMode
  IMAGE_MOTION
  HYBRID_LOCAL_I2V

MotionStrategy
  BASIC_IMAGE_MOTION
  IMAGE_TO_VIDEO
```

`IMAGE_MOTION` never schedules I2V. Its deterministic FFmpeg chapter-render foundation is implemented. `HYBRID_LOCAL_I2V` remains deferred/hardening work.

## Storage contract

```text
Cloudflare R2
  -> generated images/keyframes
  -> generated narration/audio
  -> accepted uploaded audio
  -> thumbnails/reusable pipeline media

Google Drive
  -> final rendered MP4 exports

PostgreSQL
  -> metadata, lineage, checksums, storage provider/object identity and execution state
```

Local paths and public provider URLs are never authoritative asset identities. Google Drive files remain private by default.

## Current final-video behavior

```text
READY R2 images + matching generated narration
  -> local FFmpeg IMAGE_MOTION
  -> ffprobe + checksum validation
  -> Drive resumable upload
  -> remote Drive file ID/size verification
  -> render_manifest + FinalArtifact metadata
  -> COMPLETED
```

The Drive adapter supports resumable chunk recovery within an attempt and fingerprint lookup to reuse an already-uploaded matching remote file. The local render workspace is ephemeral, so cross-attempt upload-only retry without rerender is still a hardening target.

## Current versus target media scope

| Capability | Status |
|---|---|
| Chapter analysis | IMPLEMENTED |
| Character/Location continuity | IMPLEMENTED foundation |
| Project Character list/detail | IMPLEMENTED foundation |
| Backend-authoritative MediaPlan | IMPLEMENTED foundation |
| Generated narration + R2 durability | IMPLEMENTED foundation |
| User-provided narration plan/timeline + TTS bypass | IMPLEMENTED foundation |
| Production uploaded-audio E2E | PARTIAL |
| Vertex image generation + R2 materialization | IMPLEMENTED foundation |
| READY image assets consumed by renderer | IMPLEMENTED foundation |
| IMAGE_MOTION chapter render/export | IMPLEMENTED foundation |
| Google Drive final-video upload + metadata | IMPLEMENTED foundation |
| Uploaded multi-part audio render slicing/stitching | PARTIAL/TARGET |
| Owner-authorized Drive preview/download/streaming | PARTIAL/TARGET |
| Cross-attempt upload-only retry | TARGET hardening |
| VisualScenePlanner | TARGET |
| Character/reference locking + richer image reuse lineage | PARTIAL/DEFERRED fast-follow |
| HYBRID_LOCAL_I2V end-to-end | DEFERRED fast-follow |
| Complete billing/actual-usage reconciliation | PARTIAL |

## Acceptance direction

The currently working render foundation is the generated-narration Chapter path. The full creator-loop acceptance remains broader:

```text
persisted Chapter scope
  -> analysis/review state
  -> narration strategy + aligned timeline
  -> authorized MediaPlan
  -> durable R2 image/audio assets
  -> deterministic IMAGE_MOTION
  -> validated local MP4
  -> Google Drive upload + verification
  -> READY FinalArtifact metadata
```

For `USER_PROVIDED_AUDIO`, acceptance additionally requires converting the aligned global timeline into the exact chapter-local audio input consumed by render.

A provider success response alone never completes a media stage. Pipeline media must be validated and durably stored in R2 with PostgreSQL metadata; final video must be validated, durably stored/verified in Drive and committed to PostgreSQL.

Detailed feature/status inventory: [FEATURE_CATALOG.md](FEATURE_CATALOG.md).
