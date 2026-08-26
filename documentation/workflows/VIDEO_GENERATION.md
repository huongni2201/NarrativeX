# Video / Motion Media Workflow — V1.11

NarrativeX remains image-first. A VisualBeat may use an image or video asset, but optional AI I2V is not required for the core Desktop creator loop.

## Beat media model

```text
VisualBeat
  -> selected MediaAsset
       IMAGE  -> deterministic FFmpeg camera/motion over narration span
       VIDEO  -> trim/fill/extend according to supported production policy
```

Chapter → Scene → VisualBeat is a logical timeline hierarchy. A video beat does not require the system to prerender each Scene or Chapter into nested MP4 files before editing.

V5 persisted beat media selections allow an editor-selected image/video asset to survive reload and feed production/render reads.

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

For image-selected beats, FFmpeg in Electron main applies supported deterministic camera/motion behavior for the beat's narration-derived duration. This remains the low-cost default.

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

Generated motion duration and narration-span duration are separate concepts. The production timeline still has to fit the selected media into the narration-authoritative beat span.

## Local final render

Regardless of whether a beat uses an imported video, generated motion or deterministic image motion, the primary Desktop final render is local-first:

```text
backend-authorized production snapshot
  -> selected beat media IDs + timing
  -> assigned LOCAL_DEVICE lease
  -> Electron main resolves checksum-verified local assets
  -> render/cache segments
  -> concat/mux with narration
  -> ffprobe/checksum final MP4
  -> local artifact registration
  -> backend completion metadata
```

The final Desktop MP4 remains under the project artifact workspace unless the user explicitly exports/uploads/publishes it elsewhere.

## Retained cloud/server path

Server/cloud rendering may still use remote pipeline media and Google Drive final storage:

```text
remote pipeline media -> R2
cloud worker render    -> FFmpeg/ffprobe
cloud final MP4        -> Google Drive
```

That is fallback/server behavior. Do not state that every final NarrativeX video must be uploaded to Google Drive.

## Shorts / Reels

Short/Reel artifacts are derived from approved source/timeline state and should use explicit vertical render settings/crop/reframe policy. They must preserve source/asset lineage and reuse approved media where possible instead of mutating the long-form artifact.

The same storage rule applies: a Desktop-local short can remain a local artifact; cloud upload is an explicit separate workflow, not an inherent final-render requirement.

## Remaining work

- production-complete imported-video editing semantics (trim/fill/reorder/review where allowed);
- adaptive timeline/reframe UX for mixed image/video beats;
- optional I2V provider/runtime hardening only after core creator reliability;
- provider-neutral publishing/upload from local final artifacts;
- actual compute/cost reconciliation for any self-hosted or paid motion generation.
