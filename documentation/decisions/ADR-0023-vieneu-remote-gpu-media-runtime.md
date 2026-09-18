# ADR-0023: VieNeu TTS and Media Generation Runtime on Leased Remote RTX 3090

## Status

Accepted (2026-09-18)

## Supersedes

ADR-0027 (VoiceStudio-only TTS and WhisperX-aligned WAV narration)

## Context

NarrativeX produces Vietnamese audiobook and storyboard narration. ADR-0027 previously selected VoiceStudio as the sole TTS runtime. In practice, VoiceStudio introduced operational complexity, dependency bloat, and sub-optimal Vietnamese prosody.

VieNeu (`vieneu-v3-turbo`) provides high-quality Vietnamese speech synthesis with lower latency and reliable headless execution. Furthermore, offloading heavy media synthesis to a leased or dedicated 24GB RTX 3090 host enables stable multi-modal generation without impacting the local user editor.

## Decision

1. **VieNeu as Sole Production TTS**: Replace VoiceStudio with VieNeu (`vieneu-v3-turbo`) behind the provider-neutral `audio.synthesize` Compute Protocol contract.
2. **Audio Format Guarantee**: All synthesized audio is normalized and validated as 48kHz mono signed 16-bit PCM WAV.
3. **WhisperX Forced Alignment**: WhisperX (`faster-whisper-large-v3`) runs directly against the authoritative synthesized WAV file to produce word- and phoneme-level timing.
4. **Remote RTX 3090 Workload Scope**: The remote GPU worker (`generation-service`) is strictly restricted to:
   - VieNeu TTS (`audio.synthesize`)
   - WhisperX alignment (`audio.align`)
   - ComfyUI RealVisXL v5.0 Lightning (`image.generate`)
   - Media validation (`media.validate`)
5. **Video Generation Out-of-Scope**: Video generation (`video.generate`, Wan, HunyuanVideo) is not implemented and remains documented as `DESIGNED / PLANNED`.
6. **Host GPU Residency Lifecycle**: Mutual exclusion across heavy runtimes on the RTX 3090 is enforced by `GpuResidencyManager` and `RuntimeProcessSupervisor`, verified by `nvidia-smi` VRAM reclamation probes.
7. **VoiceStudio Clean Purge**: VoiceStudio executor, configuration, catalog seeds, and test references are purged.

## Consequences

- Vietnamese speech synthesis quality and reliability are significantly enhanced.
- The GPU worker operates with clean, predictable VRAM residency on an RTX 3090.
- `ADR-0027` is formally superseded.
