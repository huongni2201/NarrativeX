# Render Motion and Quality Design

## Goal

Make still-image camera motion measurably smooth at 30/60 fps, make Editor preview consume the exact pending render decisions and frame rate, and make 1080p/1440p output use one explicit reproducible quality/color contract.

This is Workstream 1 of `2026-09-03-render-composition-parity-design.md`.

## Current Cutover Policy

NarrativeX is still pre-release. Render-profile schema v2 is therefore folded into the V1-V8 database baseline instead of adding a compatibility migration. The current database baseline admits only schemaVersion 2 render snapshots.

Consequences:

- `V5__catalog_generation_and_render_snapshots.sql` defines the final schema v2 default and constraint;
- no V9 render-profile migration exists;
- Desktop render-profile parsing supports schema v2 only and rejects missing, malformed, or unsupported schemas;
- old v1 render-profile defaults and legacy motion/frame adapters are removed after the cutover;
- developers with a database created from an older pre-release baseline must recreate/reset that development database when Flyway reports a baseline checksum change.

This policy does not apply to narration alignment records; alignment compatibility belongs to its own workstream.

## Composition Contract

Preview and export consume the same semantic decisions:

- media selection;
- IMAGE framing = `COVER`;
- VIDEO framing = `CONTAIN`;
- camera movement;
- deterministic motion easing;
- transition timing;
- selected render FPS.

The shared composition API exposes normalized numeric samples. Chromium converts those samples to CSS transforms; FFmpeg converts the same movement contract to render filters. Neither adapter may independently invent movement endpoints or framing.

Moving still images use `SMOOTHSTEP`; static images use `LINEAR`. Smoothstep is exactly `t * t * (3 - 2 * t)` after clamping `t` to `[0, 1]`.

## Narration Master Clock

The project timeline is quantized once into contiguous half-open frame windows.

- Interior boundaries use `round(ms * fps / 1000)`.
- Final project boundary uses `ceil(totalDurationMs * fps / 1000)`.
- Every beat receives at least one frame.
- The sum of beat frame counts equals the project end frame.
- Invalid partitions fail explicitly instead of changing narration timing.

Final video must never end before narration because of frame rounding.

## Preview Source of Truth

`useRenderController` owns the pending render style and frame rate. Editor preview reads the active beat decision from that exact `autoEditPlan`; it does not call a separate hard-coded `AUTO` planner.

Still-image preview animation is sampled at the selected render frame rate. Viewer controls cannot silently change exported framing.

## Still-Image Render Adapter

Moving stills render through a bounded high-resolution working canvas:

```text
source
 -> RGB/GBR working format
 -> cover scale/crop on working canvas
 -> zoompan with deterministic smoothstep progression
 -> Lanczos downscale once to target
 -> yuv420p
 -> encode
```

Working resolution rules:

- static image: target resolution;
- moving image: target resolution ×2;
- cap long edge at 5120;
- keep even dimensions;
- never use a working canvas smaller than target.

Each segment is limited with exact `-frames:v <frameCount>` and selected CFR output FPS. Nominal 60 FPS alone is not accepted as evidence of smooth motion.

## Render Profile Schema V2

Canonical profile:

```json
{
  "schemaVersion": 2,
  "rendererVersion": "project-image-motion-v3-composition",
  "compositionPolicyVersion": 1,
  "fps": 60,
  "video": {
    "x264Preset": "medium",
    "crf": 18,
    "nvencPreset": "p6",
    "nvencCq": 19,
    "pixelFormat": "yuv420p"
  },
  "color": { "mode": "SDR_BT709_LIMITED" },
  "subtitles": { "mode": "burn_in" }
}
```

The backend creates this profile once and inserts it atomically with the immutable render snapshot header. There are no post-insert `jsonb_set` mutations for FPS or subtitle mode.

Malformed individual quality values fall back to current v2 defaults; malformed JSON or an unsupported schema fails explicitly.

## Encoder Policy

Software:

```text
libx264 -preset medium -crf 18 -pix_fmt yuv420p
```

Hardware:

```text
h264_nvenc -preset p6 -rc vbr -cq 19 -b:v 0 -pix_fmt yuv420p
```

The complete NVENC profile is probed before render work starts. One encoder is selected for the entire render attempt before manifest/cache fingerprints are finalized. An attempt never mixes NVENC and x264 segment caches.

Subtitle burn-in, when it causes a second video encode, uses the same explicit quality profile.

## Color Contract

V3 output is SDR BT.709 limited-range `yuv420p`. Output metadata identifies BT.709 primaries, transfer, matrix, and limited range.

HDR tone mapping is outside this workstream. HDR input must not be silently retagged as SDR.

## Source Resolution

1440p output dimensions do not imply 1440p source detail. Preflight should compare effective source dimensions after cover crop and maximum zoom with target dimensions and report insufficient source detail separately from encode quality.

## Performance

For moving-still working canvases at least 3840x2160:

- 60 fps: max concurrency 1;
- 30 fps: max concurrency 2.

Lower resolutions retain the normal encoder cap, never above 4 and never above a lower user-configured concurrency limit.

## Cache Contract

Segment/render fingerprints include values that change pixels or cadence:

- schemaVersion;
- rendererVersion;
- compositionPolicyVersion;
- output and working dimensions;
- FPS and exact frame window;
- framing/movement/easing/transitions;
- selected encoder and quality profile;
- color mode.

No older renderer cache may be reused as v3 output.

## Tests That Must Remain

Behavioral coverage is preferred over source-text assertions.

Required tests include:

- project frame partition is contiguous and covers narration;
- smoothstep samples are deterministic;
- preview reads `autoEditPlan` and selected FPS;
- IMAGE/VIDEO framing matches the render contract;
- encoder arguments contain explicit quality values;
- backend factory output is parsed and asserted as real JSON;
- database baseline contains schema v2 and snapshot persistence is atomic;
- FFmpeg integration test executes real FFmpeg, decodes the output, verifies exactly 60 frames, CFR metadata, BT.709 metadata, and monotonic measured motion.

Tests that exist only to preserve removed schema v1, per-beat frame-clock, old CSS motion, or V9 migration behavior must be deleted with those implementations.

## CI Runtime

The packaged Windows application continues to use the bundled FFmpeg runtime contract. Linux CI installs FFmpeg/ffprobe explicitly for integration testing; CI must not assume runner images happen to contain those executables.

## Success Criteria

Workstream 1 is complete only when:

- decoded-frame motion tests pass at the intended cadence;
- Preview uses the same pending render plan/FPS as export;
- exact frame partition prevents visual underrun against narration;
- schema v2 is the only current render-profile baseline;
- quality/encoder/color settings are explicit and fingerprinted;
- obsolete v1/V9 compatibility code and tests are gone;
- Repository gates, Backend verify, AI worker checks, and Desktop check are all green.
