# Story-to-Video Workflow — V1.12

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
              -> generated/default media
              -> optional editor override
```

`VisualBeat` is the smallest production timeline span. Scene and Chapter are logical groupings, not a requirement to prerender `scene.mp4`/`chapter.mp4` before editing.

Narration/alignment is the timing authority. Exact `visual_beats.audio_start_ms/audio_end_ms` spans are required for final render admission; when timing is incomplete, Editor may still show a provisional review timeline but Render remains blocked.

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
  -> VieNeu/provider execution
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
  -> Desktop stores project media locally
  -> attach generated image to VisualBeat.preview_media_asset_id
  -> project.manifest.json resolves local bytes for preview/render
```

Project image/video media is local-first. R2 is not the production store for project media; remote storage remains reserved for account-scoped voice samples/custom voices and provider-specific transport where required. Native imported media uses a two-phase main-process selection/hash/registration flow and does not expose absolute paths as backend identity.

## Production timeline

The backend production timeline reads the current Storyboard revision directly. `VisualBeat.preview_media_asset_id` is the generated/default production source. `production_beat_media_selections` is the explicit Editor override layer, with effective precedence:

```text
READY editor override
  -> READY preview_media_asset_id
  -> missing media
```

MediaPlan infrastructure remains available for compatibility/planning, but it is not required to load the Editor timeline or admit the local-first MVP render path.

Render admission requires all of the following:

- READY narration metadata for every Chapter;
- at least one current VisualBeat per Chapter;
- exact contiguous VisualBeat audio timing from `0` through the narration duration;
- one READY effective image/video asset per VisualBeat;
- one project aspect ratio;
- a paired eligible local renderer for `LOCAL_DEVICE` execution.

Manual Editor media selection, reset, fit and trim settings are durable through `production_beat_media_selections`. Reset removes the override and immediately falls back to the generated preview source. Auto Edit derives narration-aware decisions for fit, trim and motion, with `AUTO` as the default and optional Cinematic/Balanced/Dynamic overrides. Render override application and immutable snapshot creation remain atomic in the backend.

## Real-time job tracking and subtitles

Generation, narration and local-render jobs expose owner-scoped authenticated SSE snapshots to Desktop. Electron main owns the reconnecting transport; the renderer updates React Query and retains a slow GET watchdog while a job is active. PostgreSQL remains the durable job authority.

When a render is admitted, narration text and alignment spans are captured in the immutable render input snapshot. Electron main derives renderable cues, writes a UTF-8 `subtitles.srt` file and includes it in the final FFmpeg output when cues are available.

## Final local render path

```text
backend admits + assigns local render
  -> immutable snapshot captures current narration + effective beat media
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

- adaptive narration-driven `VisualScenePlanner` and richer Scene/VisualBeat review;
- complete multi-part user-audio alignment/slicing behavior for all production scopes;
- richer media reuse/reframe/edit/regeneration lineage;
- richer timeline mutation/save/retry UX;
- richer Auto Edit explanations and manual camera override/review UX;
- long-form crash/restart recovery and soak reliability;
- production packaging/signing/auto-update and packaged OAuth/protocol tests.

See `../product/ROADMAP.md` for active work. Completed migration plans are intentionally retired.
