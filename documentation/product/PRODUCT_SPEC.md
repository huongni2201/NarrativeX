# NarrativeX — Product Specification V1.12

**Status:** maintained product contract
**Canonical source:** [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md)
**Implementation evidence:** [`../TRACEABILITY.md`](../TRACEABILITY.md)

## Product definition

NarrativeX is an AI-assisted long-form story-video studio. It is Desktop-only at the editor boundary, single-user local-first, Chapter-first, review-first, audio-timeline-first, image-first and local-media-first.

Project creation and Chapter saving persist metadata/source only. Analysis, narration/audio processing, image/video generation and final rendering are explicit operations.

## Workspace & Identity

NarrativeX boots directly into the local workspace per ADR-0030. There is no user account, login gate, guest installation identity, session cookie, or multi-tenant entitlement model. External provider credentials and GPU target settings are managed through application settings and runtime configuration.

## Creator foundations

Current foundations include:

- Single-user boot directly into workspace;
- Project/StoryVersion/Chapter authoring and dashboard;
- durable Chapter Analyze with Character/Location/Scene/VisualBeat materialization;
- generated narration plus native user-audio import/TTS-bypass foundations;
- generation-service task execution (VieNeu, WhisperX, ComfyUI, media validation);
- native local image/audio/video registration and ProjectStorage materialization;
- production timeline with narration-aligned timing and explicit beat media selection;
- Auto Edit planning, render overrides and immutable subtitle snapshots;
- backend-assigned Desktop render claim/lease;
- Electron FFmpeg/ffprobe render, journals/cache and local final artifact registration.

## Visual intent and media model

```text
Project
  -> Chapter
      -> Scene
          -> VisualBeat
              -> selected image or video MediaAsset
```

`VisualGenerationMode` intentionally supports `IMAGE` and `VIDEO`.

- `IMAGE` supports backend/generation-service image generation.
- `VIDEO` remains available in Analyze Chapter and is preserved for web/browser-driven video generation workflows.
- VIDEO intent does not imply a Python worker video-provider role.
- The removed Wan/provider-side I2V runtime must not be restored implicitly.

A video-selected beat uses trim/fill/video semantics. Image-only camera motion must not be forced onto video media.

## Narration

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

Narration alignment is the timeline authority. Generated narration is written to project-local media and materialized into Desktop ProjectStorage. User-provided audio may span Chapters or use several ordered parts on one logical clock.

## Project-media storage

```text
Generated images                -> project-local media -> Desktop ProjectStorage
Generated narration             -> project-local media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
PROJECT voice reference         -> Desktop ProjectStorage / manifest
GLOBAL_LOCAL voice reference    -> local application voice library
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Metadata                        -> PostgreSQL
```

Project bytes live locally. The backend coordinates metadata but does not proxy or host media files.

## Provider accounting boundary

Monetary billing, credit balances, reservation settlement and user-facing provider-cost accounting are not part of the current runtime contract. System capacity limits enforce concurrent job limits. Provider execution retains only the non-monetary telemetry needed for diagnostics, such as token usage, while durable provider-operation fencing and UNKNOWN reconciliation remain authoritative for retry safety.

## Final render

```text
backend-authorized production snapshot
  -> assigned paired Desktop
  -> claim + lease
  -> resolve local asset IDs/checksums
  -> FFmpeg/ffprobe
  -> subtitle mux where available
  -> checksum-verified local MP4
  -> backend artifact metadata
```

There is one final-render executor: Electron main. There is no cloud/server final-render executor, server-side Chapter render path or remote final-video fallback.

## Current versus target scope

| Capability | Status |
|---|---|
| Single-user local-first workspace | IMPLEMENTED |
| Authentication / account runtime | REMOVED |
| Per-user quota / entitlement | REMOVED |
| Runtime capacity limits | IMPLEMENTED foundation |
| Chapter analysis | IMPLEMENTED |
| Character/Location continuity | IMPLEMENTED foundation |
| Scene/VisualBeat storyboard | IMPLEMENTED foundation |
| Generated narration + local materialization | IMPLEMENTED foundation |
| User-provided narration import/TTS bypass | IMPLEMENTED foundation |
| generation-service execution scaffold | IMPLEMENTED foundation |
| VIDEO visual intent + web/browser video path | IMPLEMENTED foundation / evolving |
| Native local asset registration | IMPLEMENTED foundation |
| Mixed image/video production timeline | IMPLEMENTED foundation |
| Auto Edit + subtitle snapshot | IMPLEMENTED foundation |
| Desktop local FFmpeg render | IMPLEMENTED foundation |
| Render preflight/journal/cache | IMPLEMENTED foundation |
| Backup/restore/archive-copy | IMPLEMENTED foundation |
| Abrupt process/OS render recovery UX | PARTIAL |
| Adaptive VisualScenePlanner | TARGET |
| Rich reuse/reframe/edit lineage | DEFERRED fast-follow |
| Provider operation UNKNOWN/replay safety | IMPLEMENTED foundation |
| Non-monetary provider usage telemetry | IMPLEMENTED foundation |
| Packaging/signing/auto-update | TARGET |

## Acceptance direction

```text
project source
  -> analysis/review
  -> narration + aligned timeline
  -> generated/imported image or video media
  -> explicit production selection
  -> local materialization + integrity checks
  -> backend-authorized Desktop render
  -> validated local MP4
```

Provider success alone never completes a media stage. Results must be validated, assigned stable identity/lineage and materialized according to the active local-media contract.

Detailed status inventory: [FEATURE_CATALOG.md](FEATURE_CATALOG.md).
Active remaining work: [ROADMAP.md](ROADMAP.md).
