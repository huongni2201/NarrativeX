# ADR-0028: Image Generation Restricted to References and Keyframes Only

## Status

Accepted

## Context

Prior to ADR-0026, `ComfyUiAdapter` in `app/generation-service` served as the primary media generator, synthesizing still images that were subsequently animated with pan/zoom filters for the final master video.

With the adoption of video-first generation (ADR-0026), moving footage is produced directly by video foundation models (LTX-2.5). However, video foundation models require strong visual conditioning (faces, costumes, architecture, lighting) to maintain character consistency across shots.

## Decision

1. **Shift Image Generator Out of the Primary Video Pipeline**:
   The image generation pipeline (ComfyUI RealVisXL) is not deleted, but its mandate is strictly restricted to supporting reference preparation:
   - Character reference sheets (`CHARACTER_REFERENCE`)
   - Wardrobe and appearance snapshots (`WARDROBE_REFERENCE`)
   - Location and environment references (`LOCATION_REFERENCE`)
   - Start and end keyframes (`START_FRAME`, `END_FRAME`)
   - Keyframe milestones (`KEYFRAME`)
   - Marketing assets (`THUMBNAIL`, `POSTER`)

2. **Prohibit Primary Still Assets in Video-First Projects**:
   The creation of `SCENE_PRIMARY_STILL` assets is forbidden in `production_mode = 'VIDEO_FIRST'`.

3. **Decoupled Reference Lifecycle**:
   Character references are generated and locked once per CharacterVersion, rather than being re-generated for every individual beat.

## Consequences

- Reduces image generation compute load to upfront character/location onboarding.
- Simplifies the primary generation workflow to moving video compute.
- Ensures character consistency across video takes by providing deterministic reference conditioning to the video generator.
