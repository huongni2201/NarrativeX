# Story-to-Video Workflow

**Status:** maintained workflow contract
**Authority:** code, migrations, tests, and active ADRs (ADR-0018, ADR-0019, ADR-0020, ADR-0021, ADR-0024, ADR-0025)


NarrativeX is Desktop-only at the editor boundary, single-user local-first, Project-first, audio-timeline-first and video-first while allowing image keyframe references or fallback media per VisualBeat. Duration and visual density are adaptive.

## Entry and workspace behavior

```text
Desktop workspace
  -> Create Project       -> durable project metadata
  -> Save/import Chapter  -> persisted source
  -> edit workspace state
  -> invoke AI generation / narration / render directly
```

Per ADR-0020, NarrativeX has no user account, login modal, or authentication gate. Desktop boots directly into the project workspace. The backend remains authoritative for source identity, policy and durable job state. Desktop owns local project bytes/native execution.

## Chapter-First Continuation & Processing Boundary

Chapter is the discrete processing boundary for the entire studio workflow. A project can receive new chapters or edit existing chapters without requiring re-analysis, regeneration, or re-rendering of unaffected chapters:

```text
Local project workspace
  -> Create Project (metadata only, no implicit AI work)
  -> create / edit / reorder Chapter with If-Match concurrency control
  -> persist Chapter source text & compute sourceHash
  -> inherit snapshot of Project Bible, locked CharacterVersions, Locations, and Styles
  -> explicit Chapter Analyze invocation
  -> affected-scope resolution: only dependent downstream beats/assets are marked OUTDATED
  -> chapter audio/visual readiness
  -> include in full project render
```

- **Analysis API contract**:
  ```http
  POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
  ```
- **Optimistic concurrency**: Chapter source text, story version relation, ordering, and metadata enforce optimistic locking (`If-Match` / `rowVersion`). A stale update returns `409 CONFLICT` and never silently overwrites newer work.
- **Snapshot inheritance**: A chapter inherits an immutable snapshot of project continuity rather than a live mutable reference. Existing rendered/approved assets remain reproducible even if project-level settings change later.
- **Incremental scope**: Affected-scope resolution isolates mutations to dependent VisualBeats, narration spans, and render segments. Unaffected approved snapshots remain untouched and reusable.
- **Stale-source protection**: Durable enqueue and stage dispatch enforce source-hash checks; if source text changes while a job is running, stale results are rejected.

## Analysis & Storyboard Materialization

```text
persisted Chapter
  -> lock/reload authoritative snapshot
  -> admission + capacity limits
  -> GenerationJob / StageAttempt / outbox state
  -> Vertex Gemini chapter analysis adapter
  -> stale-source guard
  -> Character + Location + Scene + StoryBeat + AudioCue + VisualBeat materialization where supported
  -> deterministic StoryBeat/VisualBeat source anchors -> UTF-16 textStart/textEnd
```


## Editor hierarchy and timing

```text
Project
  -> StoryVersion
      -> Chapter
          -> Scene
              -> StoryBeat
                  -> AudioCue[]
                  -> VisualBeat[]
                      -> source anchor / text range
                      -> generated/default media
                      -> optional editor override
```

`StoryBeat` is the shared semantic unit; `AudioCue` and `VisualBeat` are its ordered narration and visual children. Legacy/manual VisualBeat rows without a StoryBeat remain a compatibility path and are not the canonical hierarchy. Scene and Chapter are logical groupings, not a requirement to prerender `scene.mp4`/`chapter.mp4` before editing.

Narration/alignment is the timing authority. Current production timing follows:

```text
StoryBeat/VisualBeat source_anchor
  -> deterministic UTF-16 textStart/textEnd
  -> narration/subtitle alignment spans
  -> backend NarrationTextClockMapper
  -> AudioCue/StoryBeat clock
  -> VisualBeat audio start/end/duration
```

Persisted `visual_beats.audio_start_ms/audio_end_ms` are not consumed by the Production Timeline. Runtime VisualBeat timing is derived from source text ranges plus the current narration alignment only.

When exact aligned timing is unavailable, the Editor may still receive provisional fallback timing so the storyboard remains inspectable. Render remains blocked because provisional timing is not exact narration alignment.

```text
exact aligned narration span
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
  -> generation-service VieNeu synthesis
  -> 48 kHz mono WAV master
  -> WhisperX forced alignment against the Vietnamese script
  -> local project media / Desktop materialization

USER_PROVIDED_AUDIO
  -> native import/registration
  -> ordered 1..N audio parts
  -> one logical global clock
  -> alignment
  -> no TTS for covered scope
```

Audio file boundaries do not define Chapter boundaries.

Voice-reference selection is explicit:

```text
PROJECT      -> project-local AUDIO asset / manifest
GLOBAL_LOCAL -> reusable local voice library asset
```

## Media generation and local materialization

```text
backend-authorized media work
  -> compute execution in generation-service
  -> validate bytes/result
  -> stable MediaAsset identity + checksum
  -> project-local generated media
  -> Desktop ProjectStorage materialization where required
  -> attach generated image to VisualBeat.preview_media_asset_id under its StoryBeat
  -> project.manifest.json resolves local bytes for preview/render
```

Project image/video/audio media is local-first. Native imported media uses a two-phase main-process selection/hash/registration flow and does not expose absolute paths as backend identity.

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
- current StoryBeat narration/visual plan for every Chapter;
- exact contiguous narration-aligned AudioCue/StoryBeat timing from `0` through the Chapter narration duration;
- one current VisualBeat and READY effective media for each visual span that participates in the render;
- one READY effective image/video asset per VisualBeat;
- one project aspect ratio;
- a paired eligible local renderer for `LOCAL_DEVICE` execution.

Manual Editor media selection, reset, fit and trim settings are durable through `production_beat_media_selections`. Reset removes the override and immediately falls back to the generated preview source. Auto Edit derives narration-aware decisions for fit, trim and motion. Render override application and immutable snapshot creation remain atomic in the backend.

## Real-time job tracking and subtitles

Generation, narration and local-render jobs expose project-scoped SSE snapshots to Desktop. The generation worker persists SQLite outbox events and sends signed callbacks; backend receipt/finalization is idempotent, while scheduled reconciliation handles missed or ambiguous outcomes. Electron main owns the reconnecting transport; the renderer updates React Query and retains a slow GET watchdog while a job is active. PostgreSQL remains the durable job authority.

When a render is admitted, narration text and alignment spans are captured in the immutable render input snapshot. Electron main derives renderable cues, writes a UTF-8 `subtitles.srt` file and includes it in the final FFmpeg output when cues are available.

## Final local render path

```text
backend admits + assigns local render
  -> immutable snapshot captures narration + exact timing + effective beat media
  -> assigned device claims lease
  -> Desktop preflight checks FFmpeg/ffprobe, executor, disk, assets
  -> resolve asset IDs/checksums through project.manifest.json
  -> journal execution state
  -> reuse valid segment-cache entries
  -> render missing visual segments
  -> concat video
  -> concat narration
  -> mux subtitles where available
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

- compute execution through `generation-service` with backend-owned reconciliation and artifact verification;
- adaptive narration-driven `VisualScenePlanner` and richer StoryBeat/VisualBeat review;
- complete multi-part user-audio alignment/slicing behavior for all production scopes;
- richer media reuse/reframe/edit/regeneration lineage;
- richer timeline mutation/save/retry UX;
- long-form crash/restart recovery and soak reliability;
- production packaging/signing/auto-update.

See `../product/ROADMAP.md` for active work.
