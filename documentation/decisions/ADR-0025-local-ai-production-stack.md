# ADR-0025: Local Qwen, RealVisXL and staged single-GPU production stack

## Status

Accepted — Qwen Chapter analysis, VoiceStudio narration/WhisperX alignment and the durable
RealVisXL adapter are implemented or actively cut over. Cross-process GPU residency scheduling and
video-ingest migration remain follow-up work.

## Context

NarrativeX targets a local RTX 4060 8 GB workstation for its AI-heavy production path:

1. Chinese story text to Vietnamese narrated visual video.
2. One-to-two-hour Chinese video to Vietnamese dubbed video.

The previous implementation sent Chapter analysis and image generation through Google/Vertex paths,
while Desktop also exposed a browser-driven Gemini image workflow. That split increases operational
variance and does not fit an 8 GB single-GPU runtime. Chapter analysis also needs to
translate/rewrite narration, not merely return source-language scene text.

PostgreSQL remains authoritative for durable jobs, leases, provider-operation fences and analysis
checkpoints. Electron main remains authoritative for local FFmpeg rendering. Those boundaries do
not change.

## Decision drivers

- Run the production AI pipeline on the operator-controlled workstation where practical.
- Fit the heavy local stages within an RTX 4060 8 GB VRAM budget.
- Produce natural Vietnamese narration while preserving names, glossary terms and forms of address.
- Reuse one GPU sequentially instead of executing heavy models concurrently.
- Preserve durable checkpoint, ambiguity and stale-source safety.
- Keep AI outputs schema-validated and treat source/model text as untrusted data.
- Avoid a second editor, message broker or cache solely for AI orchestration.

## Decision

NarrativeX adopts this target stack:

```text
Chinese Chapter -> Qwen3 8B AWQ -> Vietnamese narration + scene/beat plan
                                   -> RealVisXL + controlled LoRA/reference conditioning
                                   -> VoiceStudio TTS -> WhisperX forced alignment -> ASS
                                   -> Electron-main FFmpeg/NVENC -> final video

Chinese video -> FFmpeg audio extraction -> Whisper large-v3 / faster-whisper segments
              -> Qwen3 8B AWQ Vietnamese dub rewrite
              -> VoiceStudio segment TTS + duration matching
              -> WhisperX forced alignment -> ASS
              -> Electron-main FFmpeg/NVENC -> final video
```

For Chapter analysis, `Qwen/Qwen3-8B-AWQ` is served by a private local OpenAI-compatible runtime.
The Python worker remains the AI orchestration boundary and calls that endpoint with
schema-constrained requests. Every structure, shard and repair request remains fenced by existing
PostgreSQL analysis checkpoints/provider-operation rows before inference.

The request distinguishes source and output language:

- `source_language` tells Qwen how to interpret the saved Chapter.
- `preferred_locale` controls narration/title/bible output and defaults to `vi-VN`.
- image-facing visual prompt fields are emitted in English for the downstream diffusion model.
- verbatim source anchors remain in the original source language for deterministic provenance and
  alignment mapping.

RealVisXL runs behind a private ComfyUI HTTP boundary. NarrativeX preserves its existing durable
image-operation state machine: submit one image prompt, persist the ComfyUI `prompt_id`, reconcile
that exact operation after crashes/restarts, validate output, then materialize immutable local
media. Character-reference inputs are checksum-verified and must never be silently dropped; a
reference request fails closed until an explicit reference-conditioning workflow is configured.

VoiceStudio is the sole production TTS boundary. NarrativeX calls its headless API and does not load
a TTS model inside the NarrativeX worker. VieNeu is not a production fallback.

All GPU-heavy inference stages are logically serialized. Qwen, RealVisXL/ComfyUI and VoiceStudio
must not execute heavy inference concurrently on the RTX 4060. Process-local concurrency is set to
one where those stages share a worker. Because VoiceStudio is currently a separate service, a
cross-process residency/ownership mechanism is still required before claiming strict global GPU
serialization.

Vertex Gemini Chapter analysis and Vertex image generation are no longer valid production
configurations. Compatibility code may exist temporarily while old tests/adapters are deleted, but
production validation and deployment configuration must select Qwen + RealVisXL + VoiceStudio.

## Consequences

### Positive

- The main story/image/audio AI path can run locally on the user's workstation.
- Chinese-to-Vietnamese narration rewrite remains part of the validated Chapter result.
- Existing PostgreSQL durability and ambiguity rules continue to apply to local image generation.
- The 8B AWQ analysis model is materially more realistic for an 8 GB card than the previous 14B
  target, provided context and KV-cache budgets stay conservative.
- Image, audio and render stages converge on one local-first architecture.

### Negative

- Qwen, ComfyUI/RealVisXL and VoiceStudio must be installed and health-checked locally.
- An 8 GB GPU requires strict stage ownership; keeping multiple heavy model engines resident can
  exhaust VRAM even when requests are not concurrent.
- Local throughput is lower than elastic hosted APIs and must be controlled through queueing.
- A custom ComfyUI reference-conditioning workflow is required before character-reference image
  jobs can be enabled safely.

### Risks and mitigations

- **Invalid or incomplete JSON:** schema-constrained output plus authoritative Pydantic and
  deterministic continuity validation with bounded repair.
- **Ambiguous timeout:** leave the durable subcall/operation `UNKNOWN`; never blind-resubmit.
- **Prompt injection in story text:** keep system authority separate, tag story text as untrusted,
  and never allow it to grant tool or instruction authority.
- **GPU out-of-memory:** Qwen3 8B AWQ, one heavy stage at a time, conservative context, one-image
  RealVisXL operations, and explicit model residency control.
- **Character drift:** immutable CharacterVersion/reference snapshots, checksum validation and an
  explicit IP-Adapter/reference workflow; never downgrade a reference job to text-only generation.
- **Subtitle drift:** WhisperX alignment is authoritative for spoken timing; subtitle coverage does
  not need to extend across silent tail video.

## Migration plan

1. Switch production Chapter analysis to local Qwen3 8B AWQ. **Done.**
2. Replace VieNeu with VoiceStudio as the sole production TTS provider. **Done.**
3. Keep WhisperX forced alignment as the authoritative subtitle timing source. **Done/in use.**
4. Cut production API image jobs from Vertex to durable local RealVisXL/ComfyUI. **In progress.**
5. Add/configure the explicit character-reference ComfyUI workflow and verify identity consistency
   across regeneration. **Required before enabling reference jobs.**
6. Add global GPU ownership/residency coordination across Qwen, ComfyUI and VoiceStudio. **Open.**
7. Remove rollback-only Vertex analysis/image code, Google provider dependencies and stale tests.
8. Complete segmented Whisper video ingest and Vietnamese dubbing flow.
9. Remove any obsolete Desktop browser image workflow only after the active product path has been
   explicitly chosen and runtime-verified.

## Related decisions

- Supersedes the Vertex Gemini Chapter-analysis portions of ADR-0003 and ADR-0008.
- Supersedes Vertex image generation as the production API image path.
- Preserves ADR-0020 PostgreSQL-only durable runtime state.
- Preserves ADR-0012 Electron-main local project storage and final rendering.
- Extends ADR-0024 durable analysis checkpoints and continuity validation.

## References

- Qwen model/runtime target: `Qwen/Qwen3-8B-AWQ`.
- ComfyUI HTTP API is the private execution boundary for RealVisXL.
- VoiceStudio headless API is the private production TTS boundary.
