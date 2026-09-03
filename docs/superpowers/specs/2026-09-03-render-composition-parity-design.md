# Render Composition Parity Architecture

## Purpose

Define the architecture that makes NarrativeX Editor preview a trustworthy representation of final export without forcing unrelated rendering, subtitle, and narration changes into one implementation plan.

This document is the umbrella specification. It defines project-wide invariants, subsystem boundaries, sequencing, and compatibility rules. Each workstream that changes a concrete pipeline owns its own detailed design and implementation plan.

The target is not to reproduce Premiere Pro, DaVinci Resolve, or Final Cut Pro feature-for-feature. NarrativeX adopts the principles that matter for its current editor:

- one authoritative composition decision set;
- narration as the project master clock;
- deterministic frame sampling;
- measurable motion quality rather than relying on nominal FPS;
- explicit and reproducible encoder/color policy;
- preview and export consuming the same semantic edit decisions;
- versioned cache and render snapshots;
- subtitle timing and presentation derived from one canonical subtitle model.

## Problem Statement

The current application has several different implementations representing one intended video:

```text
Editor preview
  -> Chromium/CSS transforms
  -> HTML/CSS subtitle overlay
  -> browser media playback

Final render
  -> FFmpeg scale/crop/zoompan
  -> FFmpeg transition filters
  -> SRT/libass subtitle burn-in
  -> H.264 encode

Narration/subtitle timing
  -> AI-worker narration segments
  -> alignment spans
  -> Desktop cue derivation
```

Differences between these paths currently create four user-visible failure classes:

1. preview framing/motion can differ from final render;
2. 30/60 fps export can still show visible hold-and-jump image motion;
3. 1080p/1440p output can use uncontrolled or legacy encoder defaults and can still look soft when source media lacks effective resolution;
4. subtitle presentation/timing can diverge from spoken narration and from Editor preview.

These problems are connected by shared timing and composition semantics, but they do not belong in one code change.

## Architectural Invariants

Every implementation under this architecture must preserve the following rules.

### 1. Narration is the master clock

Narration duration and chapter timing are authoritative. Visual frame quantization, transitions, subtitle cues, and final muxing must adapt to narration; they must not shorten or stretch narration to simplify rendering.

The final video may extend by less than one output frame because of frame quantization, but narration audio must never be truncated by a shorter visual stream.

### 2. One semantic composition decision set

For a pending render configuration, Preview and Export must consume the same authoritative decisions for:

- media selection;
- frame interval;
- framing policy;
- video fit behavior;
- camera movement;
- motion intensity/easing where supported by the active composition-policy version;
- transition type and duration;
- subtitle cue boundaries;
- subtitle presentation policy.

The browser and FFmpeg may use different rendering adapters, but those adapters are not allowed to invent independent edit decisions.

### 3. Preview represents export frames, not an independent animation

Preview playback remains narration-driven and realtime, but visual animation state must be derived from the selected render FPS and deterministic project frame partition. A displayed preview state must correspond to a state that can exist in the final export.

Viewer-only controls such as UI zoom or inspection fit may change how the user looks at the preview surface, but cannot mutate exported framing unless represented as an explicit persisted edit decision.

### 4. Smoothness is a measured property

A stream labeled 60 fps is not automatically considered smooth. Motion implementations must be evaluated using decoded output frames and measurable spatial progression.

Regression tests must detect:

- repeated-position hold-and-jump behavior;
- backwards spatial jumps;
- incorrect frame counts;
- timeline gaps/overlaps;
- preview/export geometry drift.

### 5. Output quality is explicit and reproducible

Render jobs must carry a versioned immutable render profile. Application-owned values define encoder quality, pixel format, color contract, renderer policy version, and composition-policy version.

Machine-specific FFmpeg defaults cannot silently define output quality. Hardware acceleration may change the encoder implementation but not the semantic composition contract.

### 6. Source quality is separate from output size

Selecting 1440p guarantees the output frame dimensions and configured encode policy. It does not guarantee that an undersized source image contains 1440p detail.

Preflight must distinguish output-resolution support from effective source-resolution quality and report insufficient source detail rather than hiding it behind upscaling.

### 7. Cache reuse is version-safe

Any value that changes generated pixels, frame timing, or encoded representation must participate in the appropriate cache/fingerprint boundary.

A render produced by a previous renderer/composition-policy version must never be reused as though it were produced by the current version.

### 8. Compatibility is explicit

Existing queued/historical render snapshots and narration alignment records remain readable through their legacy versioned behavior. New policy must not be silently applied retroactively to immutable historical records.

Unsupported future schema/policy versions fail clearly instead of being interpreted as the oldest known schema.

## Workstream Decomposition

### Workstream 1: Motion, Preview/Render Geometry, and Video Quality

Detailed spec:

`docs/superpowers/specs/2026-09-03-render-motion-quality-design.md`

This workstream owns:

- canonical numeric composition sampling for image motion and framing;
- selected render style/FPS as Preview source of truth;
- project-level frame partition and final-frame handling;
- subpixel-capable FFmpeg motion adapter selection using measured output;
- source-resolution diagnostics;
- immutable render-profile schema/version cutover;
- explicit x264/NVENC quality policy;
- SDR output color contract;
- encoder selection/fallback boundaries;
- render concurrency and cache invalidation;
- FFmpeg integration tests that inspect decoded output.

This workstream does not change narration segmentation or subtitle cue-generation algorithms.

### Workstream 2: Subtitle Presentation Parity

This workstream owns only how an already-planned subtitle cue is presented in Preview and final export.

Its design must preserve these umbrella requirements:

- Preview and export receive the exact same cue start/end times and text;
- subtitle layout is represented by a shared application-owned style policy rather than independent CSS/libass defaults;
- final rendering uses a styled subtitle representation capable of expressing the selected safe area, alignment, font metrics, outline/shadow, and backing policy;
- typography must be deterministic across supported packaged systems, including explicit font/fallback behavior;
- subtitle rendering failure is visible when subtitles were requested; it must not silently export a subtitle-less file;
- subtitle-style policy version participates in final-output fingerprinting.

This workstream must not change TTS segmentation merely to improve visual style.

### Workstream 3: Narration Alignment and Subtitle Timing Precision

This workstream owns the mapping from source narration text to spoken-audio timing anchors.

Its design must preserve these umbrella requirements:

- no hard-coded global negative subtitle offset;
- no fabricated word timestamps presented as precise alignment;
- provider synthesis grouping and subtitle timing granularity are treated as separate concerns unless evidence shows they must change together;
- changes to TTS segmentation require audio-quality/prosody and performance evaluation, not only subtitle tests;
- new alignment records use a new explicit alignment version;
- historical `segment-duration-v1` data remains readable through deterministic legacy behavior;
- the final materialized narration duration remains authoritative;
- timing accuracy is evaluated against known fixtures using measurable cue-to-audio error.

This workstream may adopt provider-native word/phrase timestamps in the future if the active provider exposes stable timing data, but such data must be versioned and validated before becoming authoritative.

## Shared Data Flow

Target architecture:

```text
Timeline + Render Settings
           |
           v
Authoritative Edit / Composition Decisions
           |
           +--------------------------+
           |                          |
           v                          v
Narration-driven Preview       Immutable Render Snapshot
           |                          |
           |                          v
           |                    Render Manifest
           |                          |
           |                          v
           |                  FFmpeg render adapters
           |                          |
           +------ same policy -------+
                                      |
                                      v
                              Video encode / mux
```

Subtitle timing participates through the same model:

```text
Narration source text
       |
       v
Versioned alignment
       |
       v
Canonical PlannedSubtitle[]
       |
       +------------------+
       |                  |
       v                  v
Preview overlay      Final styled track
```

No downstream presentation adapter may recompute subtitle cue timing independently.

## Transition Boundary

The current render architecture supports duration-preserving `CUT` and `FADE_BLACK` behavior without overlapping adjacent segment timelines.

A true `CROSS_DISSOLVE` requires overlapping adjacent visual frames and changes concat/cache/timeline behavior. It is therefore outside the current parity cutover and requires a dedicated transition-compositor design before implementation.

Documentation or types must not advertise `CROSS_DISSOLVE` as an implemented v3 render capability until that cutover exists end-to-end.

## FFmpeg Responsibility

FFmpeg remains NarrativeX's media processing and final encoding/muxing engine for this architecture.

It is responsible for:

- decoding media;
- deterministic frame production from the render manifest;
- scale/transform/filter execution selected by the active renderer policy;
- color conversion;
- encoded segment output;
- audio assembly/muxing;
- styled subtitle composition for final export where applicable;
- final container production.

FFmpeg command strings are implementation details. They are not the authoritative source of composition behavior. Semantic values are computed and versioned by NarrativeX before being translated into FFmpeg filters/arguments.

## Preview Responsibility

Chromium remains the realtime preview compositor.

Preview may use GPU-backed CSS/browser transforms for responsiveness, but it must consume the same numeric composition samples, framing rules, transition samples, render-plan decisions, and subtitle cues as final render.

Pixel-identical RGB output between Chromium and compressed YUV video is not a success requirement. Geometry, timing, framing, transition state, and subtitle layout must match within explicit workstream tolerances.

## Render Snapshot and Versioning Strategy

New render-policy cutovers must be represented in the immutable render snapshot rather than inferred from the currently installed application version.

At minimum, snapshots that participate in the v3 cutover carry versioned values equivalent to:

```text
renderProfile.schemaVersion
rendererVersion
compositionPolicyVersion
fps
video quality policy
color policy
subtitle mode
```

Workstreams may add their own independent version fields where needed, such as subtitle-style policy or narration-alignment version. Version ownership follows the subsystem that creates the immutable record.

## Error Handling Principles

- Invalid new render-profile data is rejected or mapped only according to the rules of its known schema version.
- Missing source resolution or color metadata produces a diagnostic when a safe deterministic interpretation is possible.
- Unsupported HDR input is not silently retagged as SDR.
- Hardware encoder incompatibility is resolved before segment-cache production for an attempt; an attempt does not mix encoders silently.
- Missing precise narration alignment never blocks rendering when a documented legacy deterministic fallback exists.
- Requested subtitle burn-in does not silently disappear after a subtitle-generation/rendering failure.
- Timeline/frame partition errors fail admission with a precise error rather than silently changing narration timing.

## Testing Strategy

Testing is divided by responsibility.

### Shared contract tests

Prove that Preview and Render consume the same semantic decisions and versioned policy values.

### Desktop unit tests

Cover render profile parsing, composition sampling, frame partition, preview plan selection, cache/fingerprint inputs, encoder argument generation, and subtitle presentation helpers owned by the corresponding workstream.

### FFmpeg integration tests

Execute FFmpeg against deterministic fixtures and inspect actual generated output. Argument-string assertions alone are insufficient for motion, cadence, geometry, color, or mux correctness.

### AI-worker tests

Cover narration segmentation/alignment only in the alignment workstream. Subtitle visual-style changes do not require AI-worker modifications.

### Packaged Windows smoke tests

For renderer cutovers, compare fixed Preview and final-render fixtures using the packaged FFmpeg/runtime combination used by desktop releases.

## Delivery Sequence

The workstreams are implemented independently in this order:

1. Motion, Preview/Render Geometry, and Video Quality.
2. Subtitle Presentation Parity.
3. Narration Alignment and Subtitle Timing Precision.

Reason for this order:

- Workstream 1 establishes the authoritative frame/render-policy foundation required by later visual parity work.
- Workstream 2 can then make subtitle appearance deterministic without changing narration generation.
- Workstream 3 changes the most sensitive audio/TTS behavior and is isolated so subtitle timing improvements cannot destabilize render motion or encoder quality.

Each workstream gets its own implementation plan, TDD cycle, verification evidence, and review gate. Passing one workstream is not evidence that later workstreams are complete.

## Rollout Principles

- New policies are admitted through explicit versions.
- Legacy immutable records keep legacy interpretation.
- Cache generations are isolated by renderer/policy version.
- A workstream can be disabled/rolled back without rewriting project media, narration files, or historical snapshots.
- No workstream silently migrates historical alignment or render decisions in place.

## Architecture-Level Success Criteria

The architecture is fulfilled only when all workstreams relevant to a user-visible promise have completed their own measurable acceptance criteria.

At the umbrella level:

- the Editor no longer maintains an independent hidden composition decision set for final-render behavior;
- narration remains the master clock through Preview, frame partition, subtitles, and final mux;
- final motion smoothness is validated from decoded frames rather than nominal FPS;
- render quality and color behavior are versioned and explicit;
- source-detail limitations are reported separately from output resolution;
- subtitle Preview and export consume one canonical cue model;
- subtitle timing precision can evolve through versioned alignment without hard-coded offsets;
- historical render/alignment data remains readable;
- no cache crosses incompatible renderer/policy versions;
- each affected repository gate and subsystem-specific integration test passes before its workstream is considered complete.
