# NarrativeX — Product Specification V1.11

**Status:** maintained product contract  
**Canonical source:** [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md)  
**Implementation evidence:** [`../TRACEABILITY.md`](../TRACEABILITY.md)

## Product definition

NarrativeX is an AI-assisted long-form story-video studio. It is Desktop-only at the editor boundary, guest-first, Chapter-first, review-first, audio-timeline-first, image-first and local-media-first.

Project creation and Chapter saving persist metadata/source only. Analysis, narration/audio processing, image/video generation and final rendering are explicit operations.

## Authentication

A new installation opens into a stable guest-owned workspace. Google is the only end-user account sign-in provider. Provider/account-consuming actions are backend-gated and can open Google OIDC without discarding the current editor context.

## Creator foundations

Current foundations include:

- Project/StoryVersion/Chapter authoring and dashboard/favorite flows;
- durable Chapter Analyze with Character/Location/Scene/VisualBeat materialization;
- generated narration plus native user-audio import/TTS-bypass foundations;
- Vertex image generation and Gemini Web image generation;
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

- `IMAGE` supports API/worker image generation and Gemini Web generation.
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
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Voice reference/custom voice    -> R2 when account-scoped remote storage is required
Metadata                        -> PostgreSQL
```

R2 is not the project-media store and is not a transport for generated project images, generated narration or final video.

## Provider accounting boundary

Monetary billing, credit balances, reservation settlement and user-facing provider-cost accounting are not part of the current runtime contract. Provider execution retains only the non-monetary telemetry needed for diagnostics, such as token usage, while durable provider-operation fencing and UNKNOWN reconciliation remain authoritative for retry safety.

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
| Stable guest identity / guest-first workspace | IMPLEMENTED |
| Google-only account sign-in | IMPLEMENTED |
| Chapter analysis | IMPLEMENTED |
| Character/Location continuity | IMPLEMENTED foundation |
| Scene/VisualBeat storyboard | IMPLEMENTED foundation |
| Generated narration + local materialization | IMPLEMENTED foundation |
| User-provided narration import/TTS bypass | IMPLEMENTED foundation |
| Vertex image generation | IMPLEMENTED foundation |
| Gemini Web image generation | IMPLEMENTED foundation |
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
| Provider-side/local I2V planning runtime | NOT CURRENT RUNTIME |
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
