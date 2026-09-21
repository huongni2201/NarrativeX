# ADR-0026: Video-First Production Architecture and Legacy Still Motion Deprecation

## Status

Accepted

## Context

NarrativeX previously assembled video content through an image-first pipeline:
`Story → VisualBeat → Image Prompt → Image Generation (ComfyUI RealVisXL) → Pan/Zoom/Ken Burns → Timeline → Video Assembly`.

This model had severe creative, structural, and audience-retention limitations:
1. **Synthetic Motion**: Still images with programmatic FFmpeg pan/zoom/tilt ("Ken Burns") cannot convey authentic character kinetic action, emotional reaction, or natural environmental physics.
2. **Coupling of Beat to Image**: Equating a `VisualBeat` to a single image asset prevented multi-shot dramatic staging, varied camera angles, and cutaways.
3. **Pacing Rigidity**: Still asset durations were tied directly to narration sentence length, producing dragging static intervals whenever a character spoke at length.

With modern video foundation models (e.g. LTX-2.5 Distilled), generative moving video at 720p/24 FPS is technically and economically feasible within the target budget boundaries (target < 100,000 VND per episode).

## Decision

1. **Establish Video-First as the Authoritative Production Architecture**:
   NarrativeX transitions to an end-to-end video-first model:
   `Story → Retention Plan → VisualBeat → Shot Sequence → Shot → Generation Strategy → Moving Video Take → Selected Take → Editing Director → Master Video`.

2. **Deprecate Still Image as Primary Footage**:
   - For new projects, the primary visual assets on the timeline must be moving video footage.
   - The generation of primary still images for scene footage is discontinued.
   - Programmatic Ken Burns (zoompan) motion filters on still images are deprecated and removed from the active production path.

3. **Restructure Image Generation to Supporting Services**:
   Image generation is retained exclusively as an auxiliary service for visual conditioning and collateral:
   - `CHARACTER_REFERENCE` (consistent identity, wardrobe, expressions)
   - `LOCATION_REFERENCE` (architecture, lighting, environment)
   - `START_FRAME` and `END_FRAME` (for FIRST_LAST_FRAME conditioned video generation)
   - `KEYFRAME` (for multi-keyframe temporal guidance)
   - `THUMBNAIL` and `POSTER` (for distribution and packaging)

4. **Preserve Legacy Project Safety**:
   - Existing projects initialized under `production_mode = 'IMAGE_MOTION'` remain readable and exportable via legacy snapshot adapters.
   - All new projects are strictly provisioned as `production_mode = 'VIDEO_FIRST'`.

## Consequences

- Supersedes the motion model and still-image storyboard portions of ADR-0002.
- Requires updating the Compute Protocol to introduce `video.generate` tasks.
- Replaces Desktop Storyboard with a Video Shotboard supporting video playback, multi-take review, and in/out trimming.
