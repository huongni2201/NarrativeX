# Render Composition Parity Architecture

## Purpose

Make NarrativeX Editor preview a trustworthy representation of final export by sharing semantic composition and timing decisions while allowing Chromium and FFmpeg to remain different rendering adapters.

This is the umbrella architecture. Workstream-specific details belong in their own current specs.

## Architectural Invariants

### Narration is the master clock

Narration duration is authoritative. Visual frame quantization, transitions, subtitles, and final muxing adapt to narration; narration is never shortened to fit rounded visual timing.

### Preview and export share one decision set

For a pending render configuration they consume the same:

- media selection;
- frame intervals;
- framing policy;
- camera movement/easing;
- transition timing;
- selected render FPS;
- subtitle cue model when subtitle workstreams are complete.

Browser and FFmpeg adapters cannot invent independent edit decisions.

### Preview represents exportable frames

Realtime preview remains narration-driven, but still-image animation is sampled according to the selected export FPS. Viewer-only controls cannot mutate exported framing unless they are explicit persisted edit decisions.

### Smoothness is measured

A file labeled 60 FPS is not automatically smooth. Regression coverage must inspect decoded frames for frame count, monotonic spatial movement, backwards jumps, and geometry drift.

### Quality is explicit

Render jobs carry an immutable application-owned render profile. FFmpeg defaults and machine-specific encoder defaults do not silently define output quality.

### Source quality and output size are different

1440p output guarantees dimensions and encode policy, not source detail. Preflight reports insufficient source resolution separately.

### Cache reuse is version-safe

Values that change pixels, frame timing, encoder output, or presentation participate in the relevant fingerprint. Incompatible renderer generations never share cached segments.

## Pre-release Database Policy

NarrativeX is pre-release and the repository maintains a consolidated V1-V8 Flyway baseline. Completed schema cutovers are folded into that baseline rather than accumulating temporary compatibility migrations.

For Workstream 1:

- render-profile schema v2 is folded into `V5__catalog_generation_and_render_snapshots.sql`;
- V9 is not part of the current baseline;
- the current database constraint admits render-profile schema v2 only;
- Desktop does not retain schema v1 render-profile compatibility after cutover;
- developers using an older pre-release database recreate/reset it after a baseline checksum change.

This database policy is separate from versioned domain data that still has an explicit compatibility requirement, such as narration alignment.

## Workstreams

### 1. Motion, Preview/Render Geometry, and Video Quality

Current spec:

`docs/superpowers/specs/2026-09-03-render-motion-quality-design.md`

Owns:

- shared numeric composition sampling;
- selected render plan/FPS as Preview source of truth;
- project-level frame partition;
- moving-still FFmpeg adapter;
- explicit x264/NVENC profile;
- SDR color policy;
- render cache/versioning;
- source-resolution diagnostics;
- real FFmpeg decoded-frame integration tests.

### 2. Subtitle Presentation Parity

Owns appearance of already-planned subtitle cues. Preview and export must receive identical cue times/text and share an application-owned typography/layout policy. This workstream does not change TTS segmentation.

### 3. Narration Alignment and Subtitle Timing Precision

Owns mapping source narration text to spoken-audio timing. It must not use a hard-coded global offset or fabricate precise word timestamps. Alignment version compatibility is handled here independently from render-profile database cutover.

## Shared Data Flow

```text
Timeline + render settings
          |
          v
Authoritative composition decisions
          |
          +-------------------------+
          |                         |
          v                         v
Narration-driven preview      Immutable render snapshot
                                    |
                                    v
                              Render manifest
                                    |
                                    v
                              FFmpeg adapters
                                    |
                                    v
                              Encode / mux
```

Subtitle flow:

```text
Narration source
      |
      v
Versioned alignment
      |
      v
Canonical subtitle cues
      +-------------------+
      |                   |
      v                   v
Preview overlay      Final subtitle render
```

No downstream subtitle presentation adapter recomputes cue timing independently.

## Transition Boundary

Current parity work supports duration-preserving `CUT` and `FADE_BLACK`. True `CROSS_DISSOLVE` requires overlapping adjacent frame timelines and a different concat/cache contract, so it remains outside this cutover.

## FFmpeg Responsibility

FFmpeg remains responsible for media decoding, deterministic frame generation, filters, color conversion, video encoding, audio muxing, and final container production.

FFmpeg command strings are implementation details, not the semantic source of truth. NarrativeX computes/version-controls composition values first and then translates them into FFmpeg arguments.

## Chromium Preview Responsibility

Chromium remains the realtime preview compositor. It may use browser/GPU transforms for responsiveness, but geometry/timing decisions come from the same application contract used by final render.

Pixel-identical RGB output is not required because final video is compressed YUV. Geometry, framing, timing, transition state, and intended presentation must agree within explicit workstream tolerances.

## Error Handling

- malformed or unsupported current render-profile schemas fail explicitly;
- unsupported HDR is not silently retagged as SDR;
- hardware encoder compatibility is resolved before segment-cache production;
- a render attempt does not silently mix encoders;
- invalid frame partitions fail rather than shifting narration timing;
- requested subtitle rendering does not silently disappear on failure.

## Testing Strategy

Prefer behavior and rendered-output tests over source-text assertions.

- Shared unit tests prove composition/frame contracts.
- Desktop tests prove preview plan/FPS/framing and encoder arguments.
- Backend tests call the render-profile factory and parse real JSON; persistence tests validate atomic snapshot storage and current baseline state.
- FFmpeg integration tests execute FFmpeg and inspect decoded output.
- AI-worker tests are changed only by narration/alignment workstreams.
- Packaged Windows smoke tests validate the bundled production FFmpeg runtime separately from Linux CI.

Obsolete tests tied only to removed migrations, schema v1 render profiles, old per-beat clocks, or old CSS animation adapters are deleted together with the obsolete implementation.

## Delivery Order

1. Motion / geometry / video quality.
2. Subtitle presentation parity.
3. Narration alignment precision.

Each workstream must satisfy its own measurable acceptance criteria before it is considered complete.

## Architecture-Level Success Criteria

- Editor no longer maintains an independent hidden composition decision set for export behavior.
- Narration remains the master clock.
- Motion smoothness is validated from decoded frames.
- Render quality/color behavior is explicit and versioned.
- Source-detail limitations are reported separately from output size.
- Render-profile v2 is cleanly cut over into the pre-release baseline without obsolete compatibility migration/code/tests.
- Cache cannot cross incompatible renderer policies.
- Repository, Backend, AI worker, and Desktop CI gates are green for the completed workstream.
