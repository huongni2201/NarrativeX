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
  -> deterministic source segmentation
  -> admission + reservation/policy
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker/provider execution
  -> stale-source guard
  -> Character + Location + Scene + VisualBeat materialization
```

Visual Beat analysis is semantic, not a timing oracle. AI should identify a contiguous range of stable source-segment IDs for each beat. Worker code resolves those segment references against the exact Chapter source snapshot and persists UTF-16 half-open `text_start/text_end` offsets. AI must not calculate character offsets or audio timestamps.

## Editor hierarchy and timing

```text
Project
  -> Chapter
      -> Scene
          -> VisualBeat
              -> selected image or video media
```

`VisualBeat` is the smallest production timeline span. Scene and Chapter are logical groupings, not a requirement to prerender `scene.mp4`/`chapter.mp4` before editing.

Visual Beat timing has separate coordinate systems:

```text
Chapter source text
  -> VisualBeat text_start/text_end            SOURCE position
  -> narration source-to-audio alignment
  -> VisualBeat audio_start_ms/audio_end_ms     Chapter audio position
  -> Chapter global startMs + local audio span
  -> ProductionTimeline startMs/endMs           Project timeline position
```

Source offsets and audio offsets are not interchangeable. `text_start/text_end` can exist before narration does; `audio_start_ms/audio_end_ms` must remain null until a compatible persisted narration alignment is available.

Narration/alignment is the timing authority:

```text
aligned narration span
  -> reconcile VisualBeat source span
  -> VisualBeat audio start/end/duration
  -> image: deterministic motion over the span
  -> video: trim/fill/extend according to supported policy
  -> one project timeline
  -> final FFmpeg render
```

When a beat boundary falls inside a coarser narration alignment span, timing is derived deterministically from that real alignment, not guessed by AI. A later word-level alignment implementation may improve precision without changing the Visual Beat analysis contract.

Timing states are conceptually:

```text
SOURCE_ONLY / PROVISIONAL
  exact source span exists
  exact narration span does not yet exist

ALIGNED
  compatible narration alignment produced exact persisted audio offsets

PLANNED
  current immutable MediaPlan timing exists and supersedes draft timing for production planning
```

A provisional timeline may use estimated geometry for navigation, but UI and downstream code must not label that geometry narration-aligned.

Image-only camera/motion controls must not be shown as if they apply identically to video beats.

## Narration selection

```text
TTS
  -> VieNeu/provider execution
  -> validate/normalize
  -> alignment
  -> VisualBeat timing reconciliation
  -> local materialization for Desktop use

USER_PROVIDED_AUDIO
  -> native import/registration
  -> ordered 1..N audio parts
  -> one logical global clock
  -> alignment
  -> VisualBeat timing reconciliation
  -> no TTS for covered scope
```

Audio file boundaries do not define Chapter boundaries.

Reconciliation must be source-safe: narration alignment may update Visual Beat audio timing only when its source identity/hash is compatible with the current Chapter/storyboard snapshot. Stale alignment never silently writes timing for changed source text.

## Media generation and local materialization

```text
backend-authorized media work
  -> provider execution
  -> validate bytes/result
  -> stable MediaAsset identity + checksum
  -> R2 transport when remote durability is required by provider/worker execution
  -> Desktop materializes required accepted result locally
  -> project.manifest.json
```

The current Desktop image-generation flow includes chapter selection, analysis/estimate/queue/poll/review and verified remote-to-local materialization. Native imported media uses a two-phase main-process selection/hash/registration flow and does not expose absolute paths as backend identity.

## Production timeline

The backend production timeline aggregates persisted scene/beat/timing/media state. Durable beat media selections are part of the consolidated V1 schema, so an explicit editor choice survives reload and can feed render admission.

Before a current MediaPlan exists, the production-timeline read model may expose Visual Beats from the Chapter's current storyboard revision as non-renderable draft clips. Draft clips retain exact persisted audio alignment spans when available. Beats that only have source offsets may still be shown for navigation as provisional clips, but estimated geometry is not authoritative narration timing.

A current valid MediaPlan always takes precedence over storyboard fallback rows. Draft visibility must not create a MediaPlan, reserve provider cost, enqueue work, or make `readyForRender=true`.

`aspect_ratio_override` and `quality_tier_override` are true overrides. `NULL` means inherit project/default policy; it is not evidence that analysis failed to populate data.

Desktop preview playback uses the active narration element as the master clock whenever narration exists. A timer clock is only a no-audio fallback. If a real narration URL fails to load/play, playback stops and the error is shown rather than silently simulating successful synchronized playback.

Renderer draft state supports typed undo/redo/reset for supported duration/camera/fit edits. Auto Edit derives narration-aware decisions for fit, trim and motion, with `AUTO` as the default and optional Cinematic/Balanced/Dynamic overrides. Draft/Auto Edit state is not durable authority until converted to the backend render/production contract; render override application and immutable snapshot creation are atomic in the backend.

## Real-time job tracking and subtitles

Generation, narration and local-render jobs expose owner-scoped authenticated SSE snapshots to Desktop. Electron main owns the reconnecting transport; the renderer updates React Query and retains a slow GET watchdog while a job is active. PostgreSQL remains the durable job authority.

When a render is admitted, narration text and alignment spans are captured in the immutable render input snapshot. Electron main derives renderable cues, writes a UTF-8 `subtitles.srt` file and includes it in the final FFmpeg output when cues are available.

## Final local render path

```text
backend admits + assigns local render
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
  -> write artifacts/<jobId>/final.mp4
  -> register final-artifact metadata
  -> report progress/completion under current lease
  -> preview/export local MP4 directly
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

Desktop storage tooling also includes verification/accounting, completed/failed work cleanup and backup/restore/archive-copy foundations. Final MP4 bytes never travel through backend final-video storage or a server render path.

## Remaining creator-loop work

- complete deterministic VisualBeat source-span materialization and narration-timing reconciliation across both analysis-first and audio-first flows;
- adaptive narration-driven `VisualScenePlanner` and richer Scene/VisualBeat review;
- complete multi-part user-audio alignment/slicing behavior for all production scopes;
- richer media reuse/reframe/edit/regeneration lineage;
- richer timeline mutation/save/retry UX;
- richer Auto Edit explanations and manual override/review UX;
- long-form crash/restart recovery and soak reliability;
- production packaging/signing/auto-update and packaged OAuth/protocol tests.

See `../product/ROADMAP.md` for active work. Completed migration plans are intentionally retired.
