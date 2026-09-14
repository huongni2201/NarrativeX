# ADR-0025: Local Qwen, RealVisXL and staged single-GPU production stack

## Status

Accepted — Qwen chapter analysis implemented; image and video-ingest phases remain in migration.

## Context

NarrativeX must support two production workflows on an RTX 3090 24 GB host:

1. Chinese story text to Vietnamese narrated visual video.
2. One-to-two-hour Chinese video to Vietnamese dubbed video.

The previous implementation sent Chapter analysis to Vertex Gemini and also exposed a separate
Desktop Gemini Web image workflow. That split increases operational variance, sends untrusted
story content across a remote provider boundary, and does not fit a sequential single-GPU runtime.
Chapter analysis also needs to translate/rewrite narration, not merely return source-language scene
text.

PostgreSQL is already authoritative for durable jobs, leases, provider-operation fences and
analysis checkpoints. Electron main is already authoritative for local FFmpeg rendering. Those
boundaries must remain unchanged.

## Decision drivers

- Keep Chinese story and video-derived text on infrastructure controlled by the operator.
- Produce Vietnamese narration that is natural for TTS while preserving names, glossary terms and
  forms of address.
- Reuse one 24 GB GPU sequentially instead of loading every model concurrently.
- Preserve durable checkpoint, ambiguity and stale-source safety.
- Keep AI outputs schema-validated and treat source/provider text as untrusted data.
- Avoid a second editor or a new message broker/cache.

## Decision

NarrativeX adopts this local production stack:

```text
Chinese Chapter -> Qwen3 14B AWQ -> Vietnamese narration + scene/beat plan
                                     -> RealVisXL + controlled LoRA/reference conditioning
                                     -> Vietnamese TTS -> forced alignment -> ASS
                                     -> Electron-main FFmpeg/NVENC -> final video

Chinese video -> FFmpeg audio extraction -> Whisper large-v3 segments
              -> Qwen3 14B AWQ Vietnamese dub rewrite
              -> segment TTS + duration matching -> forced alignment -> ASS
              -> Electron-main FFmpeg/NVENC -> final video
```

For Chapter analysis, `Qwen/Qwen3-14B-AWQ` is served by a private local
OpenAI-compatible runtime. vLLM is the reference deployment. The Python worker remains the only AI
orchestration boundary and calls that private endpoint with schema-constrained, non-thinking
requests. Every structure, shard and repair request is fenced by the existing PostgreSQL analysis
checkpoint and provider-operation rows before inference.

The request distinguishes source and output language:

- `source_language` tells Qwen how to interpret the saved Chapter.
- `preferred_locale` controls narration/title/bible output and defaults to `vi-VN`.
- image-facing visual prompt fields are emitted in English for the downstream diffusion model.
- verbatim source anchors remain in the original source language for deterministic provenance and
  alignment mapping.

The single GPU is scheduled by durable worker roles/queues. Analysis concurrency defaults to one.
Qwen, RealVisXL, Whisper and alignment runtimes must release or reuse VRAM between stages; they are
not required to stay loaded simultaneously.

Vertex Gemini Chapter analysis is no longer a valid production configuration. The legacy adapter
may remain temporarily for rollback-only tests during migration, but production validation requires
`AI_PROVIDER_MODE=qwen`.

Gemini Web and Vertex image generation are deprecated by this decision. They remain operational
only until a durable RealVisXL adapter and the corresponding Desktop workflow migration are
complete. No new feature may deepen those paths.

## Consequences

### Positive

- Saved story content no longer leaves the operator-controlled environment for Chapter analysis.
- Chinese-to-Vietnamese narration rewrite is part of the validated Chapter result.
- The existing PostgreSQL durability and ambiguity rules continue to apply.
- The AWQ model fits a 24 GB GPU with room for the inference runtime and KV cache when context is
  configured conservatively.
- Image, audio and render stages converge on one local production architecture.

### Negative

- A local model server must be installed, monitored and started before the analysis worker.
- Qwen context length and GPU memory impose a practical Chapter-size ceiling; oversized Chapters
  will require hierarchical structure extraction rather than silently increasing context.
- Local throughput is lower than elastic hosted APIs and must be controlled through queueing.
- The repository temporarily contains both the accepted target and deprecated image adapters until
  the RealVisXL migration is complete.

### Risks and mitigations

- **Invalid or incomplete JSON:** use vLLM structured output plus authoritative Pydantic and
  deterministic continuity validation with bounded repair.
- **Ambiguous timeout:** leave the subcall `UNKNOWN`; do not blind-resubmit.
- **Prompt injection in story text:** keep system authority separate, tag story text as untrusted,
  and never allow it to grant tool or instruction authority.
- **GPU out-of-memory:** use Qwen3 14B AWQ, one analysis request at a time, a conservative model
  context, and sequential stage ownership.
- **Character drift:** resolve reusable project participants, immutable CharacterVersion snapshots
  and glossary/xưng-hô context before inference; this remains required follow-up work where the
  current payload does not yet provide those snapshots.

## Migration plan

1. Switch production Chapter analysis and health metadata from Vertex Gemini to local Qwen.
2. Persist/resolve project narration locale, Character Bible, glossary and forms-of-address context
   as immutable analysis inputs.
3. Add a durable RealVisXL + LoRA/reference-conditioning image adapter and migrate API image jobs.
4. Remove Desktop Gemini Web controls, queues, IPC and ADR-0021 implementation after runtime UI
   verification.
5. Add segmented Whisper large-v3 video ingest, Vietnamese dub rewrite, segment TTS duration
   matching and forced alignment.
6. Remove rollback-only Vertex analysis code and Google analysis configuration after one stable
   production release.

## Related decisions

- Supersedes the Vertex Gemini Chapter-analysis portions of ADR-0003 and ADR-0008.
- Supersedes ADR-0021 as the target image-generation direction; ADR-0021 remains descriptive of the
  legacy implementation until migration step 4 completes.
- Preserves ADR-0020 PostgreSQL-only durable runtime state.
- Preserves ADR-0012 Electron-main local project storage and final rendering.
- Extends ADR-0024 durable analysis checkpoints and continuity validation.

## References

- Qwen documentation: local vLLM deployment, thinking controls and structured output.
- vLLM documentation: OpenAI-compatible JSON-schema response format.
- Qwen model card: `Qwen/Qwen3-14B-AWQ`.
