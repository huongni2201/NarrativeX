# Local-First Editor and Render Design

## Goal

Complete the NarrativeX MVP flow after narration and image generation by making the current storyboard, narration timing, and local media directly editable and renderable without requiring a MediaPlan.

## Architecture Decision

Use Architecture A: local-first production.

The current storyboard revision is the production timeline source for MVP. Each Visual Beat uses `visual_beats.preview_media_asset_id` as its generated/default media source. `production_beat_media_selections` remains the manual Editor override layer. The effective media precedence is:

1. active `production_beat_media_selections` override;
2. READY `visual_beats.preview_media_asset_id` media asset;
3. no media.

Narration remains the master clock. Visual Beat `audio_start_ms` / `audio_end_ms` boundaries define the edit and render timing. MediaPlan rows may continue to exist for compatibility but are not required for the Editor, render admission, or local render snapshot.

## Data Model

No new table is required.

- `visual_beats.preview_media_asset_id`: generated/default media for the beat.
- `production_beat_media_selections`: explicit user override for media, fit mode, and video trim start.
- `media_assets`: authoritative media metadata, readiness, storage mode, size, checksum, and source duration.
- existing narration request/asset/alignment records: authoritative chapter audio.

The production timeline read model may continue returning nullable `mediaPlanId` and `mediaPlanRevision` for compatibility, but these fields no longer gate readiness.

## Production Timeline

The production timeline reads the current ACTIVE/DRAFT story version and every non-deleted chapter's current storyboard revision directly.

For each current Visual Beat it returns:

- chapter, scene, and beat order;
- title and visual intent;
- authored camera movement;
- exact narration-aligned start/end offsets;
- effective media chosen by override -> preview media precedence;
- local/remote storage metadata;
- current fit/trim values.

The Editor may inspect incomplete beats. Missing media or timing does not hide a Visual Beat.

## Timing Rules

Narration is authoritative.

A chapter is render-timing-ready only when its Visual Beats have a complete exact clock:

- the first beat starts at 0 ms;
- every beat has non-null `audio_start_ms` and `audio_end_ms`;
- every interval is positive;
- every beat starts at the previous beat's end;
- the final beat ends exactly at narration duration.

Fallback/weighted timing may still be used for non-final preview compatibility only if an existing UI needs it, but fallback timing must never make `readyForRender` true.

MVP does not support dragging Visual Beat duration. Changing narration boundaries is a later retiming feature.

## Render Admission

A chapter is ready for render when:

- narration has positive duration, valid local/remote source metadata, positive size, and checksum;
- there is at least one current Visual Beat;
- exact Visual Beat timing covers the full narration duration;
- every current Visual Beat resolves to a READY IMAGE or VIDEO asset;
- each media asset has positive size and checksum;
- LOCAL_ONLY media is accepted for LOCAL_DEVICE render.

Project `readyForRender` requires every chapter to satisfy those conditions and the project to have a positive duration and at least one beat.

`mediaPlanId`, `mediaPlanRevision`, `chapter_media_heads`, `generation_jobs`, `media_plans`, `media_beat_plans`, and `media_generation_items` are not render-admission gates for this MVP flow.

## Editor Behavior

The Editor remains narration-clock-driven.

- show the whole project timeline using exact beat boundaries;
- click/seek/select beats normally;
- switch the preview media as the narration playhead crosses beat boundaries;
- show missing-media and incomplete-timing states without blocking Editor access;
- keep duration read-only;
- allow replacing generated media with an existing/uploaded IMAGE or VIDEO;
- reset removes the manual selection and exposes `preview_media_asset_id` again;
- allow manual video fit modes `TRIM`, `LOOP`, `FREEZE_END`, `SPEED_ADJUST`;
- allow video trim start;
- allow a render-scoped/manual camera movement override without modifying narration timing.

For IMAGE media, trim is fixed at zero and video fit controls are not applicable.

## Render Flow

Reuse the current local render pipeline:

1. Editor/Render screen loads the production timeline.
2. Render screen refuses to start while `readyForRender=false` and shows concrete blockers.
3. Desktop performs local render preflight for media and narration assets plus disk/runtime readiness.
4. Backend creates an immutable project-render input snapshot from the current effective timeline.
5. Local executor claims the render job and resolves LOCAL_ONLY assets.
6. Existing FFmpeg pipeline renders beat segments, concatenates video, concatenates narration, muxes, verifies, and registers the artifact.
7. UI tracks job progress and opens the completed local artifact.

The FFmpeg segment renderer remains responsible for image camera motion and video fit modes.

## Error Handling

Use explicit blocker states rather than silently approximating final output:

- `MISSING_NARRATION`: chapter narration is not usable.
- `TIMING_INCOMPLETE`: beat boundaries do not exactly cover narration.
- `MISSING_MEDIA`: one or more beats have no effective READY asset.
- `INVALID_MEDIA`: effective media metadata is unsuitable for rendering.
- existing local preflight/runtime errors remain unchanged.

Editor operations should fail locally with the existing mutation notices and retry behavior. Render creation remains atomic: editor fit/trim overrides applied during render creation must roll back if admission or snapshot creation fails.

## Compatibility and Cleanup

Do not delete MediaPlan infrastructure in this change. Remove it from the critical MVP path only. A later cleanup can delete legacy MediaPlan-specific production code after the local-first flow has shipped and no remaining feature depends on it.

## Testing Strategy

Use red-green-refactor.

Backend coverage:

- PostgreSQL integration test for current storyboard beats without a MediaPlan;
- precedence test proving manual media selection overrides preview media;
- reset behavior proving preview media becomes effective again;
- application tests proving exact timing + READY local media admits render;
- negative tests for missing media, incomplete timing, and narration problems;
- project render use-case test proving a local-first timeline can create a snapshot/job without a MediaPlan.

Desktop coverage:

- Editor presentation states for generated/default, manual override, missing media, timing incomplete;
- inspector controls keep duration read-only and constrain IMAGE/video controls appropriately;
- Render screen blocker reporting and enabled state;
- render manifest/segment regression tests to ensure local-first snapshots retain exact narration clock and existing FFmpeg validation.

## Out of Scope

- deleting MediaPlan schema/infrastructure;
- manual drag-to-retime Visual Beats;
- multi-track BGM/SFX mixing changes;
- cloud rendering of LOCAL_ONLY media;
- adding a new rendering engine;
- changing the generated-image pipeline beyond using the already-attached preview asset as the default production source.
