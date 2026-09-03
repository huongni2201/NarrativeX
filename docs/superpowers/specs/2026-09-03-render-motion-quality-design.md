# Render Motion and Quality Design

## Goal

Make still-image camera motion in NarrativeX perceptually smooth at 30 or 60 fps, make Editor preview use the exact render decision set selected by the user, and make 1080p/1440p output use explicit, reproducible encoding and color policies.

This is the first workstream in `2026-09-03-render-composition-parity-design.md`.

## Scope

This workstream changes the Desktop preview/render path and the minimum backend snapshot metadata needed to version that path. It covers:

- one canonical numeric composition policy for preview and final render;
- deterministic frame sampling from the narration clock;
- a subpixel-capable FFmpeg adapter selected by measured output rather than assumption;
- explicit x264/NVENC quality settings;
- constant-frame-rate output with exact expected frame counts;
- source-resolution diagnostics for 1440p;
- bounded render concurrency and cache invalidation.

It does not change subtitle generation or narration alignment. Those are separate workstreams.

## Non-goals

- Do not replace Electron/FFmpeg with a full native GPU compositor.
- Do not promise pixel-identical RGB values between Chromium and an H.264 YUV output.
- Do not synthesize intermediate frames for 24/30 fps source video. Source-video motion can still repeat frames when exported at 60 fps.
- Do not add CROSS_DISSOLVE in this cutover. The supported transition contract remains `CUT | FADE_BLACK` because the current concat-copy pipeline does not overlap adjacent clips.
- Do not use output resolution alone as evidence of source detail.
- Do not implement HDR tone mapping in this workstream.

## Authoritative Composition Contract

Create a pure shared module consumed by both renderer-side preview code and main-process render planning. It must expose numeric geometry, not CSS or FFmpeg command strings.

```ts
export type MediaFramingMode = "COVER" | "CONTAIN";
export type MotionEasing = "LINEAR" | "SMOOTHSTEP";
export type BeatTransitionType = "CUT" | "FADE_BLACK";

export interface BeatCompositionPolicyV1 {
  version: 1;
  framing: MediaFramingMode;
  cameraMovement: string;
  motionIntensity: number;
  motionEasing: MotionEasing;
  transitionType: BeatTransitionType;
  transitionInMs: number;
  transitionOutMs: number;
}

export interface CompositionFrameSample {
  zoom: number;
  centerX: number;
  centerY: number;
  videoOpacity: number;
}

export function sampleCompositionFrame(
  policy: BeatCompositionPolicyV1,
  localFrame: number,
  frameCount: number,
  fps: number,
): CompositionFrameSample;
```

Contract rules:

- `motionIntensity` is finite and clamped to `[0, 1]`.
- `centerX` and `centerY` are normalized source-space coordinates in `[0, 1]`.
- `NONE` produces `zoom=1`, `centerX=0.5`, `centerY=0.5`.
- IMAGE framing defaults to `COVER`; VIDEO framing defaults to `CONTAIN`.
- V1 uses `motionIntensity=1` for a moving preset and `0` for `NONE`; style-specific manual intensity is a future contract extension.
- V1 uses `SMOOTHSTEP` for moving still images and `LINEAR` only for static or explicitly legacy policy.
- Smoothstep is exactly `t * t * (3 - 2 * t)` after clamping `t` to `[0, 1]`.
- Intensity scales every preset away from the neutral sample: `1 + (presetZoom - 1) * intensity` for zoom and `0.5 + (presetCenter - 0.5) * intensity` for centers.
- Existing movement endpoint values remain sourced from the versioned shared movement presets.
- Transition milliseconds are converted once to frame counts with `round(ms * fps / 1000)` and clamped to at most half the beat frame count.
- `FADE_BLACK` opacity is sampled from those integer transition-frame counts. Preview and FFmpeg must not each invent a different time-based fade curve.

CSS and FFmpeg adapters may format these values differently, but neither adapter may independently choose framing, easing, endpoints, transition timing, or transition opacity.

## Preview Source of Truth

The Editor currently recomputes the selected beat with `createBeatDecision(selected, "AUTO")`, while the render dialog owns a separate `autoEditPlan` and selectable style/frame rate. That split must be removed.

Required behavior:

1. `useRenderController` remains the owner of selected `autoEditStyle` and `frameRate`.
2. Editor preview consumes the decision for the active beat from that controller's exact `autoEditPlan`.
3. Preview must not call a second hard-coded `AUTO` planner for presentation.
4. The preview `Fit / 100% / Fill` control is either removed or renamed as a viewer-only zoom control; it cannot alter media framing.
5. The same render frame rate selected in the dialog drives preview frame sampling.
6. Preview and render manifest record the same `rendererVersion` and `compositionPolicyVersion`; a preview cannot claim v3 parity while displaying a legacy v2 decision set.

## Deterministic Frame Partition and Narration Master Clock

Replace independent per-beat duration rounding with one project-level frame partition. The project timeline is partitioned into contiguous half-open windows `[startFrame, endFrame)`.

Rules:

- frame zero corresponds to project time zero;
- interior beat boundaries use `round(boundaryMs * fps / 1000)`;
- the final project boundary uses `ceil(totalDurationMs * fps / 1000)` so the video can never end before narration audio;
- each beat receives at least one frame;
- if a pathological set of sub-frame beats cannot satisfy contiguity and one-frame minimums, render admission fails with a precise timeline error rather than silently changing narration timing;
- the sum of all beat frame counts equals the final project end frame.

For preview and render:

```text
projectFrame = clamp(floor(projectTimeMs * fps / 1000), 0, projectEndFrame - 1)
localFrame = projectFrame - beat.startFrame
progress = localFrame / max(1, beat.frameCount - 1)
```

The active preview beat is resolved from the same frame windows. The maximum visual boundary displacement from an interior millisecond boundary is half a frame. Every previewed animation state therefore corresponds to a frame that can exist in the export.

Each rendered segment must contain exactly its assigned `frameCount`. Command generation uses an exact frame limit and normalized CFR timestamps rather than relying on the interaction between `-t` and output `-r` alone.

Final mux rules:

- narration duration remains authoritative;
- the concatenated video stream must cover at least the probed narration duration;
- if a codec/container timestamp edge still leaves video shorter, clone/pad the final video frame before muxing;
- `-shortest` may end excess padded video at the narration endpoint, but it must never truncate narration because of a rounded-down video timeline;
- verification permits less than one output-frame of video-over-audio tail and zero audio truncation.

## Renderer Adapter Decision Gate

The existing `zoompan` path evaluates crop geometry on integer raster coordinates. The implementation must not assume that merely raising output fps fixes spatial stepping.

Before production cutover, add an automated fixture that evaluates both candidates with the packaged FFmpeg feature set:

1. `perspective` with per-frame evaluation and cubic interpolation at target resolution;
2. `zoompan` on an RGB/GBR supersampled working canvas followed by Lanczos downscale.

Select one adapter at development time using the acceptance tests below. Store that choice in a renderer policy/version constant. Do not choose a different adapter silently per user machine.

If `perspective` passes geometry and frame-count tests, prefer it because it preserves fractional spatial sampling without forcing oversized intermediate frames. Otherwise use the supersampled fallback.

### Supersampled fallback

The fallback must:

- convert to an RGB/GBR working pixel format before dynamic crop/transform evaluation so chroma subsampling does not quantize spatial coordinates;
- choose a 2x target working size where affordable;
- cap the long edge at 5120 pixels and keep even dimensions;
- apply the sampled motion on the working canvas;
- downscale once with Lanczos;
- convert to the final YUV pixel format only after geometry and downscale.

Static images use the target canvas directly. Supersampling must not alter frame count, timestamps, or duration.

## Source Resolution and Framing Diagnostics

A 2560x1440 container cannot create detail absent from the selected image. Before rendering, probe each source image's width and height and calculate the effective source area after aspect-ratio cover crop and maximum planned zoom.

Preflight behavior:

- no warning when effective source width and height are each at least the target dimensions;
- quality warning when either effective dimension is below target;
- strong warning when either effective dimension is below 75% of target;
- rendering remains allowed unless the media file is unreadable.

The warning identifies the beat and source/target effective dimensions. Lanczos may improve resampling quality but must not be described as restoring missing detail.

## Immutable Render Profile V2

New render jobs must not inherit quality policy accidentally from a database column default and then mutate only individual JSON fields. The backend owns one render-profile factory and writes the full immutable profile when the snapshot header is inserted.

New profile shape:

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
  "color": {
    "mode": "SDR_BT709_LIMITED"
  },
  "subtitles": {
    "mode": "burn_in"
  }
}
```

Persistence rules:

- the create-render use case builds this JSON once from validated request values and catalog defaults;
- `ProjectRenderInputSnapshotMapper.insertHeader` stores it in the same insert as the immutable snapshot header;
- new v2 snapshots do not rely on sequential `jsonb_set` updates for fps/subtitle mode;
- existing schemaVersion 1 snapshots remain readable and map to the legacy renderer/profile defaults;
- unsupported future schema versions fail clearly instead of being interpreted as schemaVersion 1.

Normalized Desktop structure:

```ts
export interface ParsedVideoQualityProfile {
  x264Preset: "veryfast" | "faster" | "fast" | "medium" | "slow";
  crf: number;
  nvencPreset: "p4" | "p5" | "p6" | "p7";
  nvencCq: number;
  pixelFormat: "yuv420p";
}
```

Defaults for new schemaVersion 2 jobs are:

```text
x264Preset = medium
crf = 18
nvencPreset = p6
nvencCq = 19
pixelFormat = yuv420p
```

Validation rules:

- CRF and CQ must be integers in `[0, 51]`; malformed values use the defaults associated with that profile schema rather than arbitrary clamping.
- Presets and pixel format are allow-listed.
- The normalized profile is included in the immutable render manifest and fingerprint.
- Legacy schemaVersion 1 snapshots use `veryfast/20`, `p5/21`, and `yuv420p` so old queued jobs remain reproducible.

Argument generation:

```text
libx264:    -c:v libx264 -preset <preset> -crf <crf> -pix_fmt yuv420p
h264_nvenc: -c:v h264_nvenc -preset <preset> -rc vbr -cq <cq> -b:v 0 -pix_fmt yuv420p
```

## Encoder Selection and Fallback

Runtime discovery currently proves only that a minimal NVENC command starts. Before rendering a job, probe the complete normalized profile using the selected pixel format, preset, rate control, and a representative target size.

Rules:

- choose one encoder for the whole render before any cache key is calculated;
- if the full-profile hardware probe fails, choose libx264 before segment rendering starts;
- never concatenate a mixture of NVENC and x264 segment caches;
- an encoder failure after rendering starts fails the attempt as retryable; it does not silently continue with a second encoder inside the same attempt;
- an explicit retry may choose software after the hardware failure is recorded.

## SDR Color Contract

V3 supports SDR inputs and emits BT.709 limited-range `yuv420p`.

Rules:

- still images are treated as sRGB and converted to the BT.709 output contract through an explicit supported FFmpeg color-conversion path before final YUV conversion;
- SDR videos with valid color metadata are converted deliberately when their metadata differs from the output contract;
- videos with missing color metadata are treated as BT.709 SDR and produce a diagnostic warning;
- PQ/HLG/BT.2020 HDR input is rejected by v3 preflight with `HDR_INPUT_UNSUPPORTED`; the renderer must not silently retag HDR pixels as SDR;
- output metadata identifies BT.709 primaries, transfer, matrix, and limited range;
- setting metadata tags without performing the required pixel conversion is not sufficient.

All segment and final streams are constant frame rate. Verification inspects `r_frame_rate`, `avg_frame_rate`, expected decoded video frame count, dimensions, output color metadata, audio duration, and timestamp continuity. Reading one nominal frame-rate field is insufficient.

## Performance Budget

High-quality filters execute before the hardware encoder and therefore require an explicit CPU/memory budget.

Default concurrency caps:

- 3840x2160-or-larger working canvas at 60 fps: 1 moving-still segment;
- 3840x2160-or-larger working canvas at 30 fps: 2 moving-still segments;
- lower working sizes: retain the existing encoder cap, never above 4.

The preflight temporary-space estimate includes working policy, output fps, cache profile, and whether later subtitle composition requires an additional encoded artifact. Cache writes remain atomic.

## Cache and Versioning

Introduce `project-image-motion-v3-composition` and include in segment cache keys and manifest fingerprints:

- render-profile schema version;
- renderer policy version and composition-policy version;
- selected renderer adapter;
- output and working dimensions;
- fps and exact frame window;
- framing;
- movement preset version, intensity, and easing;
- transition type/durations/frame counts;
- chosen encoder and normalized quality profile;
- output color policy.

No v2 segment may be reused as v3 output.

## Tests and Acceptance

### Pure contract tests

- easing endpoints are exactly 0 and 1 and samples are monotonic;
- transition opacity is derived from integer transition-frame counts;
- preview and FFmpeg adapters consume the same numeric samples;
- IMAGE resolves to COVER and VIDEO to CONTAIN;
- the selected render style and frame rate, not hard-coded AUTO/continuous time, drive preview;
- frame windows are contiguous, cover narration, and sum to the project end frame;
- final project frame count uses ceiling while interior boundaries retain nearest-frame quantization;
- v1 and v2 render profiles normalize to their own reproducible defaults.

### Preview/render geometry tests

For synthetic media with known dimensions, calculate the source crop rectangle used by the browser adapter and FFmpeg adapter at start, middle, and final frames. Corresponding rectangle edges may differ by at most 0.5 target pixel after conversion to target-space coordinates. Pan direction, zoom direction, framing mode, and transition opacity must agree exactly.

### FFmpeg integration tests

CI executes FFmpeg instead of only inspecting generated argument strings. Use a pinned/tested FFmpeg build and a high-contrast fixture with known edges.

For a 24-pixel one-second pan at 60 fps:

- output contains exactly 60 frames;
- measured edge-centroid movement is monotonic;
- maximum deviation from the ideal sampled position is at most 0.5 target pixel;
- no backward jump is permitted;
- the chosen adapter measurably outperforms the current target-resolution `zoompan` baseline on the same metric.

Also verify:

- 30/60 fps and 1080p/1440p dimensions;
- video duration covers narration and final mux does not truncate audio;
- BT.709 conversion and metadata for an sRGB still fixture;
- HDR fixture rejection;
- normalized encoder arguments and full-profile NVENC fallback;
- cache invalidation across renderer/profile/encoder changes.

### Manual packaged-Windows smoke test

Render the same fixed fixture in Editor preview and the packaged Windows build, compare start/middle/end frames, and verify no visible crop-direction reversal, hold-and-jump motion, unexpected fit-mode change, audio-tail cut, or color-space shift.

## Rollout and Rollback

- New jobs carry schemaVersion 2 and the v3 renderer version.
- Preview switches to v3 only when the same v3 policy is used for the pending render settings.
- Existing schemaVersion 1/v2 jobs remain readable and render through the legacy adapter.
- Rollback disables schemaVersion 2 admission without rewriting existing project media, narration, or immutable render snapshots.

## Success Criteria

This workstream is complete when:

- still-image motion meets the measured spatial-error and frame-count criteria at 30/60 fps;
- preview samples the exact selected render plan, policy version, and frame rate;
- source images that cannot genuinely support 1440p are reported clearly;
- the selected encoder profile is explicit, fully probed, fingerprinted, and reproducible;
- 1440p output has correct dimensions, cadence, SDR conversion, and BT.709 metadata;
- narration audio is never truncated by frame quantization;
- resource limits prevent 4K/60 intermediates from running with unsafe concurrency;
- all affected Desktop, backend, repository, and FFmpeg integration gates pass.
