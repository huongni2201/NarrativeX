# ADR-0007: Narration audio — VieNeu TTS and WhisperX forced alignment

- **Status:** Accepted
- **Date:** 2026-10-15 (consolidated; original decision 2026-09-18)
- **Replaces:** former ADR-0023 and the VoiceStudio-only runtime (Git history)

## Context

NarrativeX narrates Vietnamese stories. The former VoiceStudio runtime had weak Vietnamese prosody and a heavy dependency footprint. Narration alignment is also the production clock for narration-driven timelines (ADR-0006), so the TTS output and the alignment input must be the same bytes.

## Decision

1. VieNeu (`vieneu-v3-turbo`) is the only production TTS, reached through the provider-neutral `audio.synthesize` task of the Compute Protocol.
2. Synthesized audio is normalized and validated as 48 kHz mono signed 16-bit PCM WAV.
3. WhisperX (`faster-whisper-large-v3`) runs `audio.align` against that exact WAV and the same `NarrationScript` text. It produces word- and phoneme-level timing and never rewrites the script.
4. `media.validate` checks audio artifacts before registration.
5. `USER_PROVIDED_AUDIO` is an explicit alternative source. It may span chapters or come in ordered parts on one logical clock. It skips TTS, and an alignment failure stops for creator review instead of falling back to TTS.
6. Heavy runtimes on one GPU are serialized by `GpuResidencyManager` and `RuntimeProcessSupervisor` in generation-service.
7. VoiceStudio executor, configuration, seeds and tests are removed.

## Invariants

1. TTS narrates the approved script as-is. Spring owns admission and durable operation state, and provider libraries stay inside executor adapters.
2. For video takes with native audio (ADR-0008), WhisperX may be used for QC and subtitle timing, but VieNeu is never a hidden clock for those shots.

## Consequences

- Vietnamese narration quality improved, and VRAM residency stays predictable.
- Per-word subtitle timing for native-audio takes is a separate, partial capability (see [current status](../current-status.md)).

## Related

- [ADR-0006](ADR-0006-story-structure-and-source-anchoring.md) · [ADR-0008](ADR-0008-video-first-shot-production.md) · [GPU worker runtime](../operations/gpu-worker-runtime.md)
