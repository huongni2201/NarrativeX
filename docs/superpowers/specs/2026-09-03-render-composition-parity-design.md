# Render Composition Parity Design

## Goal

Make NarrativeX preview and final render consume the same composition decisions so exported video is visually trustworthy, motion remains smooth at 30/60 fps, 1440p output preserves image quality, and subtitle timing/style no longer diverge between preview and final output.

The target is not to reproduce the entire architecture of Premiere Pro, DaVinci Resolve, or Final Cut Pro. The target is to adopt the same core principles that matter for NarrativeX: one authoritative composition contract, subpixel-capable motion evaluation, bounded high-quality rendering, deterministic frame timing, and cacheable render decisions.

## Scope

This design covers four tightly connected render-quality problems:

1. preview and export currently use different spatial/composition implementations;
2. image camera motion is evaluated through FFmpeg `zoompan`, which can visibly step even when the final stream is 60 fps;
3. render profile quality settings exist in the backend snapshot but are not fully consumed by the desktop encoder path;
4. subtitle timing is derived from coarse narration segments and final subtitle styling differs from the HTML/CSS preview.

The implementation keeps FFmpeg as the final media encoder/muxer. It does not replace the entire desktop rendering stack with a new native compositor in this change.

## Non-goals

- Do not introduce a completely new native GPU rendering engine in this change.
- Do not add a large third-party video-editing framework solely to solve parity.
- Do not implement true word-level forced alignment unless the existing TTS provider already exposes stable timing data that can be consumed without a new provider dependency.
- Do not remove hardware encoding.
- Do not make output quality depend on machine-specific hidden defaults.
- Do not fix subtitle lag using a hard-coded global negative offset.

## Architectural Principles

### 1. One composition contract

Preview and final render must read the same authoritative presentation values for each beat:

- frame start/end;
- media type;
- fit/framing policy;
- camera movement;
- motion intensity;
- motion easing;
- transition type/duration;
- subtitle cue timing;
- subtitle presentation policy.

The browser preview is allowed to use a lower-cost implementation, but it must not invent presentation behavior that does not exist in final render. Likewise, the FFmpeg path must not have a separate hidden framing or motion policy.

### 2. Deterministic frame timing

For an output frame rate `fps`, beat animation is evaluated by integer output frame index, not by accumulated wall-clock timers.

For frame `n` inside a beat:

```text
progress = clamp((n - firstFrame) / max(1, frameCount - 1), 0, 1)
```

Motion easing transforms this progress before camera transform evaluation. The same easing function and motion preset values must be available to preview and render.

### 3. Subpixel motion first, encoding second

The exported frame sequence must preserve fractional transform progression even when the destination is only 1920x1080 or 2560x1440.

The FFmpeg implementation will therefore render moving still images on a bounded supersampled working canvas, perform zoom/pan there, and downscale to target output dimensions with Lanczos filtering.

This does not make FFmpeg a full GPU compositor. It specifically addresses the current pixel-stepping weakness while keeping the existing render architecture intact.

### 4. Explicit quality profile

Render quality must be represented by validated application values and translated into encoder arguments deliberately. FFmpeg encoder defaults must not silently define NarrativeX quality.

## Composition Contract

Create a small shared presentation policy layer that can be consumed from both renderer-side preview code and main-process render planning.

The exact file boundaries may follow existing project conventions, but the contract should expose equivalents of:

```ts
type MediaFramingMode = "COVER" | "CONTAIN";
type MotionEasing = "LINEAR" | "EASE_IN_OUT";

interface BeatPresentationPolicy {
  framing: MediaFramingMode;
  cameraMovement: string;
  motionIntensity: number;
  motionEasing: MotionEasing;
  transitionOut: string;
  transitionDurationMs: number;
}
```

Default framing policy is explicit:

- IMAGE -> `COVER`;
- VIDEO -> `CONTAIN`.

The current preview-only `Fit`/`Fill` control must not silently change the authoritative exported composition. If retained, it is an inspection/viewer control only and must be visually labeled or implemented in a way that cannot be mistaken for an export decision.

## Preview Behavior

### Spatial parity

`EditorPreviewViewport` must derive media `object-fit` behavior from the shared framing policy:

- image preview uses cover when final render uses scale-increase + crop;
- video preview uses contain when final render uses scale-decrease + pad.

### Motion parity

Preview continues to use browser/GPU transforms for realtime playback, but transform values are produced from the same shared motion preset/easing functions used to build the offline render transform.

The preview clock continues to use narration-driven project time. Animation progress derives from the deterministic beat/frame interval rather than an independent CSS animation duration.

### Subtitle parity

Preview and final render both consume the same `PlannedSubtitle[]` cue boundaries. HTML/CSS remains acceptable for live preview, but its safe-area, alignment, font weight, outline/shadow intent, and background policy must be represented by a shared subtitle style policy that the final ASS/libass output can reproduce closely.

## Smooth Offline Motion

### Current problem

The current image pipeline performs target-resolution scale/crop and then `zoompan`. Slow camera movement can advance across integer raster coordinates in visible steps. Raising stream fps from 30 to 60 produces more encoded frames but does not guarantee more unique spatial samples.

### Working-resolution policy

For beats with camera movement other than NONE, calculate a working canvas larger than the target output. The working size is deterministic and bounded:

1. start from a 2x target scale;
2. preserve the target aspect ratio;
3. cap the long edge at 3840 pixels;
4. force even width and height;
5. never choose dimensions smaller than the target output.

Examples for 16:9:

- 1280x720 -> 2560x1440 working canvas;
- 1920x1080 -> 3840x2160 working canvas;
- 2560x1440 -> 3840x2160 working canvas.

For static images with no camera motion, supersampling is unnecessary and the renderer may use the target canvas directly.

### FFmpeg filter order

Moving still-image render path should conceptually be:

```text
source image
  -> scale/crop to working canvas
  -> zoompan at manifest fps on working canvas
  -> Lanczos downscale to target dimensions
  -> setsar=1
  -> target pixel format
```

The target output frame count remains authoritative. Supersampling must not change clip duration or output fps.

### Easing

Support the existing `LINEAR` contract and make `EASE_IN_OUT` deterministic through a shared easing helper. The default cinematic motion policy should prefer `EASE_IN_OUT` where the edit decision already requests it; this change must not silently rewrite historical edit decisions.

## Encoder Quality Profile

Extend the parsed desktop render profile so it consumes the existing video settings carried by the backend render snapshot.

Expected normalized structure:

```ts
interface ParsedVideoQualityProfile {
  x264Preset: string;
  crf: number;
  nvencPreset: string;
  nvencCq: number;
  pixelFormat: string;
}

interface ParsedRenderProfile {
  fps: number;
  subtitleMode: "burn_in" | "none";
  video: ParsedVideoQualityProfile;
}
```

Validation rules:

- malformed or absent values fall back to the current catalog defaults;
- CRF/CQ must remain inside encoder-valid ranges before command generation;
- pixel format must come from the supported allow-list rather than arbitrary render-profile text;
- encoder preset values must come from supported allow-lists.

### libx264

Segment and subtitle-burn encode paths must explicitly apply:

```text
-c:v libx264
-preset <x264Preset>
-crf <crf>
-pix_fmt <pixelFormat>
```

### h264_nvenc

Segment and subtitle-burn encode paths must explicitly apply the normalized NVENC quality policy, including preset and constant-quality behavior. The implementation should use an FFmpeg-compatible argument set equivalent to:

```text
-c:v h264_nvenc
-preset <nvencPreset>
-rc vbr
-cq <nvencCq>
-b:v 0
-pix_fmt <pixelFormat>
```

If the installed FFmpeg build rejects a selected hardware encoding mode, preserve the current software fallback behavior rather than producing a corrupted or partially completed render.

### Avoid uncontrolled second-generation loss

When subtitles are burned into the final video, the final subtitle encode must use the same explicit quality policy rather than FFmpeg defaults. This keeps the unavoidable current second video encode controlled.

The implementation may later eliminate the extra generation by integrating subtitle composition earlier, but that larger pipeline rewrite is outside this change.

## Subtitle Timing

### Current problem

Narration alignment currently identifies timing at synthesized narration-segment granularity. A segment may contain up to roughly 1400 characters. Subtitle planner then splits text inside that large audio span and distributes cue boundaries by visible-character weight. This can make a cue appear late or remain on screen after the spoken phrase has moved on.

### Fine-grained alignment policy

Keep provider synthesis grouping and subtitle alignment concerns explicit rather than hiding lag with an offset.

Introduce a configurable narration alignment segmentation target that groups complete sentences/phrases into substantially smaller timing spans while preserving natural TTS continuity.

Requirements:

- split only on existing sentence/phrase boundaries where possible;
- never split inside a word solely to hit a character target;
- target size is configuration-driven, not embedded independently in subtitle code;
- retain a safe maximum size for provider requests;
- exact synthesized audio duration remains authoritative for each materialized span;
- bump the stored alignment version so new fine-grained alignment can be distinguished from historical `segment-duration-v1` data.

A default target in the 320-480 character range is acceptable, with the implementation selecting one documented default based on existing provider/test behavior. The hard maximum remains separately configurable so the target is a quality policy, not a provider limitation.

Historical projects with old alignment data continue to use the current deterministic fallback. They are not silently assigned fabricated word timestamps.

## Subtitle Styling

Plain SRT cannot encode the current preview presentation accurately. Final subtitle burn-in should therefore generate ASS (or another libass-compatible styled subtitle representation) from the same planned cues.

The shared style policy must define at least:

- bottom safe-area position;
- centered alignment;
- font size derived from output frame height;
- semibold/bold intent using an available application/system font fallback;
- readable outline/shadow;
- dark translucent backing behavior where supported consistently.

The generated subtitle track must not depend on a machine-specific custom font file bundled through an unsafe path. If an exact font is unavailable, fall back predictably while preserving timing and layout.

## Cache and Fingerprinting

Any render cache key or manifest fingerprint that can reuse encoded beat output must incorporate values that materially affect generated frames:

- output dimensions;
- fps;
- framing policy;
- camera movement/intensity/easing;
- working-resolution policy version/dimensions;
- encoder quality profile where encoded cache artifacts depend on it;
- subtitle mode/style version for final subtitle output.

Changing one of these values must invalidate only the render artifacts whose pixels or encoding actually change.

## Failure Handling

- Invalid video profile values fall back to catalog-safe defaults and are logged with enough context to diagnose the bad profile.
- Unsupported hardware encoder configuration falls back through the existing software encoder path.
- Working-resolution calculation must remain bounded to avoid accidental 5K/8K intermediate frames for 1440p output.
- Missing precise narration alignment never blocks rendering; deterministic subtitle fallback remains available.
- ASS generation failure fails subtitle burn-in clearly instead of silently exporting a subtitle-less file when subtitles were requested.
- Preview display/inspection controls must never mutate export policy unless they are persisted as explicit edit decisions.

## Testing

### Desktop render profile

Add tests proving:

- profile parser preserves fps/subtitle mode plus validated video quality values;
- malformed CRF/CQ/preset/pixel format uses known defaults;
- x264 command generation includes explicit preset/CRF/pixel format;
- NVENC command generation includes explicit preset/CQ/rate-control/pixel format;
- subtitle burn-in receives the same explicit encoder quality policy.

### Motion smoothness

Add tests proving:

- 30 fps and 60 fps frame windows remain contiguous and duration-preserving;
- working canvas is larger than target for moving still images and bounded by a 3840-pixel long edge;
- static images do not pay unnecessary supersampling cost;
- moving-image FFmpeg filter generation performs motion before Lanczos downscale;
- shared easing endpoints are exact and monotonic;
- preview and render use the same motion/framing decision helpers.

### Preview/render parity

Add tests proving:

- IMAGE maps to cover in both preview and render policy;
- VIDEO maps to contain in both preview and render policy;
- preview-only inspection state cannot alter persisted render decisions;
- active preview subtitle and generated final subtitle track derive from the same planned cue times.

### Subtitle timing

Add AI-worker tests proving:

- long narration text is divided at sentence/phrase boundaries into finer alignment spans;
- spans retain complete source text coverage in order;
- configuration target changes grouping deterministically;
- alignment version changes for newly generated fine-grained alignment;
- existing historical/fallback subtitle planning remains supported.

### Verification

Before completion run the repository's normal gates, including:

- desktop unit tests and `npm run check`;
- AI-worker pytest/Ruff/mypy gates affected by narration changes;
- backend verification only if backend contracts are modified;
- repository gates;
- targeted render regression tests for 30 fps, 60 fps, 1080p, and 1440p profile generation.

## Rollout

This change is designed as a compatible cutover rather than a destructive migration.

1. New render jobs parse and apply explicit quality settings.
2. Preview immediately consumes shared framing/motion policies.
3. New moving still-image renders use bounded supersampling.
4. Newly generated narration alignment uses the fine-grained alignment version.
5. Historical narration alignment remains readable through the existing fallback path.
6. Existing render/profile database rows remain valid because the backend already stores the relevant video quality fields.

## Success Criteria

The change is complete when all of the following are true:

- a 60 fps pan/zoom produces distinct smooth spatial progression rather than obvious target-resolution pixel stepping;
- selecting 1440p changes both output dimensions and uses explicit high-quality encoder settings;
- enabling subtitles no longer falls back to uncontrolled encoder defaults for the final re-encode;
- image and video framing in the Editor match final-render framing decisions;
- subtitle preview and final output use identical cue start/end times and closely matching safe-area/style policy;
- newly generated narration provides materially finer subtitle timing anchors without a hard-coded time offset;
- render cache invalidation accounts for the new frame-affecting policies;
- all affected CI gates pass.