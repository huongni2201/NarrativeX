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

CSS and FFmpeg adapters may format these values differently, but neither adapter may independently choose framing, easing, endpoints, or transition timing.

## Preview Source of Truth

The Editor currently recomputes the selected beat with `createBeatDecision(selected, "AUTO")`, while the render dialog owns a separate `autoEditPlan` and selectable style/frame rate. That split must be removed.

Required behavior:

1. `useRenderController` remains the owner of selected `autoEditStyle` and `frameRate`.
2. Editor preview consumes the decision for the active beat from that controller's exact `autoEditPlan`.
3. Preview must not call a second hard-coded `AUTO` planner for presentation.
4. The preview `Fit / 100% / Fill` control is either removed or renamed as a viewer-only zoom control; it cannot alter media framing.
5. The same render frame rate selected in the dialog drives preview frame sampling.

## Deterministic Frame Clock

`renderFrameWindow(globalStartMs, globalEndMs, fps)` remains the canonical interval quantizer. Beat windows are half-open `[startFrame, endFrame)`.

For preview and render:

```text
projectFrame = round(projectTimeMs * fps / 1000)
localFrame = clamp(projectFrame - startFrame, 0, frameCount - 1)
progress = localFrame / max(1, frameCount - 1)
```

The active preview beat must be resolved by frame window when playing at the selected render fps. This permits at most half a frame of quantization relative to raw millisecond boundaries and guarantees that the preview displays a frame that can exist in the export.

Each rendered segment must contain exactly `frameCount` frames. Command generation must use an exact frame limit and normalized CFR timestamps rather than relying on the interaction between `-t` and an output `-r` alone. Concatenated output must preserve the sum of all expected segment frame counts.

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

The warning must identify the beat and source/target effective dimensions. Lanczos may improve resampling quality but must not be described as restoring missing detail.

## Explicit Video Quality Profile

Normalize the backend render profile into an application-owned structure:

```ts
export interface ParsedVideoQualityProfile {
  x264Preset: "veryfast" | "faster" | "fast" | "medium" | "slow";
  crf: number;
  nvencPreset: "p4" | "p5" | "p6" | "p7";
  nvencCq: number;
  pixelFormat: "yuv420p";
}
```

Defaults for new high-quality render jobs are:

```text
x264Preset = medium
crf = 18
nvencPreset = p6
nvencCq = 19
pixelFormat = yuv420p
```

Validation rules:

- CRF and CQ must be integers in `[0, 51]`; malformed values use the documented defaults rather than arbitrary clamping.
- Presets and pixel format are allow-listed.
- The normalized profile is included in the immutable render manifest and fingerprint.
- Legacy snapshots lacking these values use the prior catalog defaults (`veryfast/20`, `p5/21`, `yuv420p`) so old queued jobs stay reproducible.

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

## Color and Output Cadence

The export contract is SDR BT.709 with limited-range `yuv420p`. Image inputs are treated as sRGB and converted explicitly. Color conversion happens once after spatial composition. Output metadata must identify BT.709 primaries, transfer, and matrix.

All segment and final streams must be constant frame rate. Verification must inspect both `r_frame_rate` and `avg_frame_rate`, expected video frame count, dimensions, and timestamp continuity. Merely reading one nominal frame-rate field is insufficient.

## Performance Budget

High-quality filters execute before the hardware encoder and therefore require an explicit CPU/memory budget.

Default concurrency caps:

- 3840x2160-or-larger working canvas at 60 fps: 1 moving-still segment;
- 3840x2160-or-larger working canvas at 30 fps: 2 moving-still segments;
- lower working sizes: retain the existing encoder cap, never above 4.

The preflight temporary-space estimate must include working policy, output fps, cache profile, and whether subtitle composition will later require additional artifacts. Cache writes remain atomic.

## Cache and Versioning

Introduce a new renderer version, for example `project-image-motion-v3-composition`, and include in segment cache keys and manifest fingerprints:

- renderer policy version;
- selected renderer adapter;
- output and working dimensions;
- fps and exact frame window;
- framing;
- movement preset version, intensity, and easing;
- transition type/durations;
- chosen encoder and normalized quality profile;
- output color policy.

No v2 segment may be reused as v3 output.

## Tests and Acceptance

### Pure contract tests

- easing endpoints are exactly 0 and 1 and samples are monotonic;
- preview and FFmpeg adapters consume the same numeric samples;
- IMAGE resolves to COVER and VIDEO to CONTAIN;
- the selected render style and frame rate, not hard-coded AUTO/continuous time, drive preview;
- frame windows are contiguous and sum to the expected project frame count.

### FFmpeg integration tests

CI must execute FFmpeg, not only inspect generated argument strings. Use a pinned/tested FFmpeg version and a high-contrast fixture with known edges.

For a 24-pixel one-second pan at 60 fps:

- output contains exactly 60 frames;
- measured edge-centroid movement is monotonic;
- maximum deviation from the ideal sampled position is at most 0.5 target pixel;
- no backward jump is permitted;
- the chosen adapter must visibly outperform the current target-resolution `zoompan` baseline on the same metric.

Also verify 30/60 fps, 1080p/1440p dimensions, BT.709 metadata, normalized encoder arguments, and cache invalidation.

### Manual packaged-Windows smoke test

Render the same fixed fixture in Editor preview and the packaged Windows build, compare start/middle/end frames, and verify no visible crop-direction reversal, hold-and-jump motion, or unexpected fit-mode change.

## Rollout and Rollback

- New jobs carry the v3 renderer version.
- Preview switches to v3 only when the same v3 policy is used for the pending render settings.
- Existing v2 jobs remain readable and render through the legacy adapter.
- Rollback disables v3 admission without rewriting existing project media or narration.

## Success Criteria

This workstream is complete when:

- still-image motion meets the measured spatial-error and frame-count criteria at 30/60 fps;
- preview samples the exact selected render plan and frame rate;
- source images that cannot genuinely support 1440p are reported clearly;
- the selected encoder profile is explicit, fully probed, fingerprinted, and reproducible;
- 1440p output has correct dimensions, cadence, and BT.709 metadata;
- resource limits prevent 4K/60 intermediates from running with unsafe concurrency;
- all affected Desktop, backend, repository, and FFmpeg integration gates pass.
