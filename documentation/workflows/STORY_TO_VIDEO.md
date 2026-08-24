# Story-to-Video Workflow — V1.11

NarrativeX is desktop-first, Chapter-first, audio-timeline-first and image-first. Video duration and visual count are adaptive.

## Entry

```text
Create Project -> metadata only
Save Chapter   -> persisted source only
Analyze        -> explicit durable operation
```

The Spring backend remains authoritative for source identity, ownership, policy and job state. Electron Desktop is the primary editor and local project-media/render surface.

## Analysis foundation

```text
persisted Chapter
  -> lock/reload snapshot
  -> entitlement/quota/cost admission
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker/provider execution
  -> stale Chapter guard
  -> Character + Location + Scene + VisualBeat continuity
```

## Narration selection

```text
GENERATED NARRATION
  -> Google TTS or VieNeu/provider execution
  -> validate/normalize
  -> alignment
  -> materialize according to execution mode

USER_PROVIDED_AUDIO
  -> ordered 1..N audio parts
  -> one logical global audio clock
  -> alignment
  -> no TTS for covered scope
```

One audio file may cover many Chapters and several files may cover one selected range. Alignment, not file boundaries, assigns source spans to time.

For Desktop local rendering, accepted narration bytes must be registered in the local project workspace/manifest.

## Media planning and images

The backend owns MediaPlan authorization and provider workers/devices execute the pinned policy.

```text
pinned image-generation work
  -> provider execution
  -> validate
  -> stable MediaAsset identity/checksum
  -> materialize according to execution mode
```

Desktop target:

```text
validated image
  -> local project assets/images
  -> project.manifest.json
  -> local render resolves mediaAssetId
```

The Vertex provider foundation exists. Complete Desktop-local materialization for every generation/regeneration path is still PARTIAL.

`VisualScenePlanner` remains TARGET as the richer narration-driven adaptive planning/review layer.

## Primary Desktop render path — implemented foundation

```text
backend admits + assigns LOCAL_DEVICE render
  -> assigned Desktop device claims job + lease
  -> claim provides narration/image IDs + expected checksums
  -> Electron main resolves local files through project.manifest.json
  -> reject missing/invalid inputs
  -> build deterministic local render manifest
  -> FFmpeg render visual segments
  -> concatenate video
  -> concatenate narration
  -> mux audio/video
  -> ffprobe + SHA-256 validation
  -> register local artifact under artifacts/<jobId>/
  -> report progress/completion to backend
```

The backend records a provider identity such as `LOCAL_DESKTOP` plus an opaque project-relative artifact key and media metadata. Absolute machine paths are not durable backend identifiers.

Lease heartbeat runs during local execution. Lease loss prevents successful completion. In-process cancellation exists; restart-safe recovery/resume remains partial.

Local project rendering requires FFmpeg/ffprobe and `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true`.

## Retained cloud render path — fallback

The existing worker path remains available during migration:

```text
cloud render
  -> R2 pipeline inputs
  -> worker FFmpeg/ffprobe
  -> Google Drive final MP4
  -> provider-aware FinalArtifact metadata
```

This cloud path remains real but is no longer the primary Desktop storage/render architecture.

## Desktop project storage

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/{images,audio,video}/
  work/
  artifacts/<jobId>/final.mp4
```

The manifest maps backend asset identities to project-relative paths plus size/SHA-256. Electron main owns local path resolution.

## User-provided narration render path

The planning/TTS-bypass/global-clock model exists. Complete E2E behavior depends on materializing the relevant aligned audio locally and producing the exact render input for the selected scope.

Required shape:

```text
alignment spans
  -> identify relevant ordered parts
  -> slice/concatenate when necessary
  -> validate one render audio input
  -> register local narration asset/checksum
  -> LOCAL_DEVICE render
```

Do not claim the complete multi-Chapter uploaded-audio → local-render loop until this is proven by code/tests.

## Current local render state semantics

```text
backend job assigned to device
  -> claimed lease
  -> local execution RUNNING
  -> periodic lease heartbeat + progress
  -> COMPLETED | FAILED

lease loss / cancellation
  -> abort local process
  -> no successful finalization by stale owner
```

Cross-process crash/restart recovery is still a hardening target.

## Fast-follow

- complete image/TTS/import local materialization;
- complete multi-part user-audio local render integration;
- narration-driven VisualScenePlanner/review;
- richer timeline mutations and regeneration/reuse;
- disk cleanup/backup/move/repair;
- restart-safe local render recovery;
- packaging/signing/auto-update/protocol hardening;
- provider-neutral publishing/upload from local artifacts;
- remove legacy web only after parity gates pass.

## Deterministic full-stack testing

Paid/external provider boundaries may be replaced by deterministic fakes in E2E tests, but production architecture claims must still distinguish:

- Desktop local project storage/render;
- retained cloud/legacy R2/Drive worker execution;
- backend-authoritative domain/job/lease state.
