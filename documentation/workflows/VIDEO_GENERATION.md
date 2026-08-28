# Video / Motion Media Workflow — V1.11

NarrativeX remains image-first. A VisualBeat may use an image or video asset, but optional AI I2V is not required for the core Desktop creator loop.

## Beat media model

```text
VisualBeat
  -> selected MediaAsset
       IMAGE  -> deterministic FFmpeg camera/motion over the production beat span
       VIDEO  -> trim/fill/extend according to supported production policy
```

Chapter -> Scene -> VisualBeat is a logical timeline hierarchy. A video beat does not require the system to prerender each Scene or Chapter into nested MP4 files before editing.

Persisted beat media selections are part of the consolidated V1 schema and allow an editor-selected image/video asset to survive reload and feed production/render reads.

Electron main probes imported audio/video duration before local registration. Known video source duration is carried into the timeline and render contract so `TRIM`, `LOOP`, `FREEZE_END` and `SPEED_ADJUST` decisions can be validated against the source rather than guessed at render time.

## Timing semantics

Narration is the intended visual master clock when compatible exact alignment exists, but current timing sources must remain distinguishable:

```text
PLANNED
  current immutable MediaPlan timing
  -> authoritative for production/render planning

ALIGNED (target for draft storyboard)
  VisualBeat source span
  -> compatible narration alignment
  -> exact audio_start_ms/audio_end_ms

FALLBACK / PROVISIONAL
  generic backend timeline geometry used when exact beat timing is incomplete
  -> navigable/editor-friendly
  -> NOT proof of exact narration alignment
```

At the audited code checkpoint, semantic VisualBeat analysis and narration alignment persistence exist, but deterministic `visual_beats.text_start/text_end` and source-to-audio reconciliation are not yet complete for every analyzed beat. Therefore docs and UI must not label generic fallback geometry as exact narration timing.

## Imported video — current Desktop direction

Imported user video is a first-class local project media candidate. Native import follows the same secure local-media boundary as other imports:

```text
Electron native picker
  -> main inspect/hash
  -> backend stable MediaAsset registration
  -> main commit to project assets/video
  -> manifest relative path + size + SHA-256
  -> select for VisualBeat
```

Renderer/backend state uses stable IDs and metadata, never arbitrary absolute machine paths.

## Deterministic image motion — primary path

For image-selected beats, FFmpeg in Electron main applies supported deterministic camera/motion behavior for the production beat duration. When a current MediaPlan exists, its timing is authoritative. Exact narration-derived storyboard timing may be used only after compatible source-to-audio reconciliation exists; otherwise fallback geometry remains provisional.

Image-only controls such as camera/pan/zoom behavior must not be displayed as if they are required for video-selected beats.

## Optional AI I2V — deferred/fast-follow

The domain may support a provider-neutral motion-generation policy such as:

```text
IMAGE_MOTION
  -> deterministic image motion only

HYBRID_LOCAL_I2V
  -> deterministic image motion by default
  -> selected eligible beats may use self-hosted/private I2V
```

`IMAGE_MOTION` must not schedule paid/compute-heavy I2V. A future I2V implementation must remain behind a `VideoGenerationProvider`-style adapter and backend-authorized OperationPlan rather than adding provider-specific branches to domain policy.

Current docs must not describe Wan/self-hosted I2V as required for the production Desktop path unless the code/tests for that path are present and enabled.

## Durable optional I2V rules

If/when an I2V operation is authorized:

```text
approved VisualBeat + source keyframe/media identity
  -> capability/cost/entitlement admission
  -> OperationPlan + reservation
  -> GenerationJob / StageAttempt
  -> ProviderOperation persisted before submit
  -> provider execution/reconciliation
  -> validate MotionAsset
  -> immutable identity/lineage
  -> review/approve or fallback
```

Ambiguous provider acceptance becomes `UNKNOWN` and reconciles before resubmission. Failed/rejected generated motion does not destroy the source keyframe or prevent deterministic fallback when policy allows it.

Generated motion duration and production beat duration are separate concepts. Selected media must be fitted into the authoritative production span chosen by the current plan/alignment contract rather than silently changing narrative timing.

## Final render

Regardless of whether a beat uses an imported video, generated motion or deterministic image motion, final rendering is a Desktop-local operation:

```text
backend-authorized production snapshot
  -> selected beat media IDs + authoritative snapshot timing
  -> assigned local-device lease
  -> Electron main resolves checksum-verified local assets
  -> render/cache segments
  -> subtitle cues from immutable narration text/alignment snapshot
  -> write UTF-8 SRT and mux with narration when cues exist
  -> ffprobe/checksum final MP4
  -> write project artifacts/<jobId>/final.mp4
  -> register backend artifact metadata
  -> preview/export local MP4 directly
```

Subtitle cues may legitimately be narration-aligned even while draft VisualBeat timing reconciliation is incomplete; those are separate contracts.

The final MP4 remains under the project artifact workspace unless the user explicitly exports/uploads/publishes it elsewhere. The backend never stores or proxies final video bytes.

AI-generated images/narration may use R2 while provider/worker execution requires remote durable transport, but accepted project media bytes are materialized locally before final rendering.

## Shorts / Reels

Short/Reel artifacts are derived from approved source/timeline state and should use explicit vertical render settings/crop/reframe policy. They must preserve source/asset lineage and reuse approved media where possible instead of mutating the long-form artifact.

A short remains a Desktop-local artifact until the user explicitly exports or publishes it.

## Remaining work

- exact VisualBeat source-span and narration timing reconciliation for draft storyboard preview;
- production-complete imported-video editing semantics (trim/fill/reorder/review where allowed);
- adaptive timeline/reframe UX for mixed image/video beats;
- optional I2V provider/runtime hardening only after core creator reliability;
- provider-neutral publishing/upload from explicitly exported local final artifacts;
- actual compute/cost reconciliation for any self-hosted or paid motion generation.
