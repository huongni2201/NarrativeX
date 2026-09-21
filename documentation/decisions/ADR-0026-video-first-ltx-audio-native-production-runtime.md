# ADR-0026: Video-First LTX Audio-Native Production Runtime and Hardware Baseline

## Status

Accepted (Supersedes ADR-0026 still-motion portion and updates runtime baseline of ADR-0023).

## Context

NarrativeX initially relied on a pipeline where still images generated via ComfyUI were animated using synthetic Ken Burns pan/zoom filters and fitted to narration audio pre-rendered via VieNeu TTS and aligned via WhisperX.

This model suffered from multiple limitations:
1. **Lack of authentic kinematics**: Still image pan/zoom fails to convey genuine character kinetic action, facial expressions, and natural physical reactions.
2. **Narration clock lock-in**: Forcing visual duration to equal narration sentence duration produced static, dragging scenes during long speeches.
3. **Hardware evolution**: Modern generative video foundation models (e.g. LTX-2.5 19B/NVFP4) now enable full-frame moving video with synchronized audio generation at 720p/24 FPS within operational budget limits.
4. **Target GPU shift**: Authoritative remote GPU execution target transitions to NVIDIA GeForce RTX 5090 32GB, which provides the VRAM headroom required for FP4/FP8 video generation pipelines without swapping thrashing. The previous RTX 3090 24GB remains solely as a benchmark baseline and historical deployment reference.

## Decision

1. **Authoritative GPU Target**:
   - **Production Target**: NVIDIA GeForce RTX 5090 32GB VRAM.
   - **Benchmark & Baseline Reference**: NVIDIA GeForce RTX 3090 24GB VRAM is retained exclusively for cost benchmarking and historical reference.

2. **Primary Generative Video Runtime**:
   - LTX-2.5 (`ltx-2.5-nvfp4` / `ltx-2.5`) is established as the primary generative video runtime.
   - The Compute Protocol exposes `video.generate` as a provider-neutral task. Provider-specific parameters (such as ComfyUI node wiring or model flags) are encapsulated within the worker adapter.

3. **Synchronized Audio & Voice Consistency**:
   - LTX generates moving video accompanied by synchronized audio when supported.
   - Character voice consistency is maintained via explicit `CharacterVoiceProfile` reference audio assets (`GLOBAL_LOCAL` or `PROJECT` scope) resolved dynamically from `AudioCue.speakerProjectCharacterId`.

4. **Role of WhisperX**:
   - WhisperX is repurposed as an **output quality control (QC) and subtitle synchronization engine**, rather than being a mandatory sequential prerequisite before visual generation.
   - For generated footage with audio, WhisperX performs automated speech-to-text validation, confidence scoring, and subtitle word-timing extraction.

5. **Role of VieNeu**:
   - VieNeu is retained strictly for documented auxiliary functions:
     - Rapid preview speech synthesis during authoring.
     - Reference speech preparation and voice conditioning.
     - Explicit fallback narration when audio-native video generation is disabled or unavailable.
   - VieNeu is not a hidden timeline authority over video shots.

6. **FFmpeg Master Composition Engine**:
   - FFmpeg in Electron desktop remains the definitive timeline composition and master packaging engine:
     - In/out trimming of selected takes.
     - Inter-shot and inter-scene transitions (cut, dissolve, fade to black).
     - Subtitle rendering (.ass styling).
     - Audio stem mixing, loudness normalization, and final MP4/H.264 packaging.

7. **GPU Residency Families**:
   - Dedicated residency families managed by `GpuResidencyManager`:
     - `LTX_VIDEO` (primary moving video generation, VRAM budget ~16-24GB).
     - `VIENEU` (preview and reference speech).
     - `WHISPERX` (ASR QC and subtitle alignment).
     - `COMFYUI_IMAGE` (reference keyframes, character sheets, posters, and thumbnails).

8. **Execution Reliability**:
   - Execution adheres to strict idempotency, durable execution handles (`ltx:{promptId}`), checkpoint recovery, and reconciliation of `UNKNOWN` submission states before any re-submission.

## Consequences

- Upgrades the Compute Protocol with `video.generate`.
- Establishes `Shot` and `Take` as the atomic units of video production.
- Decouples visual pacing from rigid pre-generated TTS sentence boundaries.
- Replaces legacy `ACCOUNT` voice scope with single-user `GLOBAL_LOCAL` library.
- Operational runtimes and scripts target RTX 5090 32GB nodes.
