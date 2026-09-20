# ADR-0022: Vertex AI Gemini 3.8 Flash for Chapter Analysis Control Plane

## Status

Accepted (2026-09-18)

## Supersedes

The historical text-generation compute-boundary decision (formerly referenced as ADR-0032; preserved in Git history)

## Context

Chapter analysis transforms raw narrative text into structured storyboard scenes, visual beats, and character actions. This requires deep contextual reasoning, long-context narrative comprehension, and rigid adherence to a complex structured output schema containing 12 distinct visual direction attributes per visual beat.

The previous architecture routed chapter analysis through a local or compute-plane Qwen model via
`text.generate`. That historical decision is preserved in Git history and introduced several
critical limitations:
1. Contended for scarce GPU VRAM on media worker nodes against image generation and TTS.
2. Context window limits constrained the analysis of full novel chapters.
3. Lower reasoning density resulted in frequent schema violations and hallucinated narrative beats.

## Decision

1. **Direct Vertex AI Integration in Spring Boot**: The Spring Boot backend (modular monolith control plane) communicates directly with Google Vertex AI for chapter analysis, isolated behind the `ChapterAnalysisProvider` outbound port. The compute plane (`generation-service`) is never invoked for text generation.
2. **Model Specification**: Uses `gemini-3.8-flash` with thinking level set to `HIGH`.
3. **Structured Schema Enforcement**: Output is constrained to a strict JSON schema requiring `scenes`, `visual_beats`, character participants, and 12 visual direction fields (`subject_action`, `shot_framing`, `camera_movement`, `lighting`, etc.).
4. **Token Preflight Guard**: Chapter text is token-counted preflight via the Vertex `:countTokens` endpoint. Inputs exceeding the soft limit of 800,000 tokens are rejected fail-closed with `ChapterAnalysisContextTooLargeException`.
5. **Usage & Provenance Telemetry**: Every analysis execution records prompt tokens, output tokens, thinking tokens, cached tokens, and runtime milliseconds alongside the persisted `ChapterAnalysisSnapshot`.
6. **Authentication**: Uses Application Default Credentials (ADC) via `google-auth-library-oauth2-http` with explicit developer override capability.
7. **Complete Qwen Purge**: Qwen executor, configurations, and test suites are deleted from production paths.

## Consequences

- Compute plane nodes are completely relieved of text generation tasks and retain zero LLM runtime overhead.
- Chapter analysis achieves superior structural fidelity and nuanced visual beat decomposition.
- The historical Qwen/text-generation decision is formally superseded; its old identifier is retained only in Git history.
