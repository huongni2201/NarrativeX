# Story-to-Video Workflow — V1.11

NarrativeX is Desktop-only at the editor boundary, Chapter-first, audio-timeline-first and image-first while allowing image or video media per VisualBeat. Duration and visual density are adaptive.

## Entry and guest behavior

```text
Desktop guest workspace
  -> Create Project       -> durable project metadata
  -> Save/import Chapter  -> persisted source
  -> edit free workspace state

Gated AI/provider action
  -> backend requires ROLE_USER
  -> LoginModal + Google OIDC
  -> resume same editor route
```

The backend remains authoritative for source identity, ownership, policy and job state. Desktop owns local project bytes/native execution only.

## Analysis

```text
persisted Chapter
  -> lock/reload authoritative snapshot
  -> admission + reservation/policy
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker/provider execution
  -> stale-source guard
  -> Character + Location + Scene + VisualBeat materialization
```

## Editor hierarchy and timing

```text
Project
  -> Chapter
      -> Scene
          -> VisualBeat
              -> selected image or video media
```

`VisualBeat` is the smallest production timeline span. Scene and Chapter are logical groupings, not a requirement to prerender `scene.mp4`/`chapter.mp4` before editing.

Narration/alignment is the timing authority:

```text
aligned narration span
  -> VisualBeat start/end/duration
  -> image: deterministic motion over the span
  -> video: trim/fill/extend according to supported policy
  -> one project timeline
  -> final FFmpeg render
```

Image-only camera/motion controls must not be shown as if they apply identically to video beats.

## Narration selection

```text
TTS
  -> Google TTS or VieNeu/provider execution
  -> validate/normalize
  -> alignment
  -> local materialization for Desktop use

USER_PROVIDED_AUDIO
  -> native import/registration
  -> ordered 1..N audio parts
  -> one logical global clock
  -> alignment
  -> no TTS for covered scope
```

Audio file boundaries do not define Chapter boundaries.

## Media generation and local materialization

```text
backend-authorized media work
  -> provider execution
  -> validate bytes/result
  -> stable MediaAsset identity + checksum
  -> Desktop materializes required accepted result locally
  -> project.manifest.json
```

The current Desktop image-generation flow includes chapter selection, analysis/estimate/queue/poll/review and verified remote-to-local materialization. Native imported media uses a two-phase main-process selection/hash/registration flow and does not expose absolute paths as backend identity.

## Production timeline

The backend production timeline aggregates persisted scene/beat/timing/media state. V5 adds durable beat media selections so an explicit editor choice survives reload and can feed render admission.

Renderer draft state supports typed undo/redo/reset for supported duration/camera edits. Draft state is not durable authority until converted to the backend render/production contract.

## Local render path

```text
backend admits + assigns LOCAL_DEVICE render
  -> assigned device claims lease
  -> Desktop preflight checks FFmpeg/ffprobe, executor, disk, assets
  -> resolve asset IDs/checksums through project.manifest.json
  -> journal execution state
  -> reuse valid segment-cache entries
  -> render missing visual segments
  -> concat video
  -> concat narration
  -> mux
  -> ffprobe + SHA-256 final validation
  -> register local artifact under artifacts/<jobId>/
  -> report progress/completion under current lease
```

Lease loss prevents success. In-process cancellation and unfinished-journal discovery exist. Richer crash/restart resume/retry UX remains hardening work.

## Local storage

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/{images,audio,video}/
  work/
  artifacts/<jobId>/final.mp4
```

Desktop storage tooling also includes verification/accounting, completed/failed work cleanup and backup/restore/archive-copy foundations.

## Retained cloud/server path

Where remote provider/server execution still requires it:

```text
pipeline media -> Cloudflare R2
cloud render   -> worker FFmpeg/ffprobe
final MP4      -> Google Drive
```

This remains fallback/server behavior, not the Desktop project-storage default.

## Remaining creator-loop work

- adaptive narration-driven `VisualScenePlanner` and richer Scene/VisualBeat review;
- complete multi-part user-audio alignment/slicing behavior for all production scopes;
- richer media reuse/reframe/edit/regeneration lineage;
- richer timeline mutation/save/retry UX;
- long-form crash/restart recovery and soak reliability;
- production packaging/signing/auto-update and packaged OAuth/protocol tests.

See `../product/ROADMAP.md` for active work. Completed migration plans are intentionally retired.
