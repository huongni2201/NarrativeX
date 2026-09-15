# ADR-0027: VoiceStudio-only TTS and WhisperX-aligned WAV narration

## Status

Accepted (updated: 2026-09-15 — voice-reference scope refined by ADR-0030 to PROJECT and GLOBAL_LOCAL, removing obsolete ACCOUNT scope)

## Context

ADR-0025 selected a local AI/media direction but left the Vietnamese TTS engine unspecified. The
implemented worker subsequently embedded VieNeu and accumulated provider-specific configuration,
dependencies, batching, catalog previews and voice-name mapping. Keeping that implementation as a
fallback beside VoiceStudio would require testing and operating two model runtimes while an RTX
4060 provides only 8 GB of VRAM.

NarrativeX also knows the exact Vietnamese script before synthesis. Re-transcribing that audio as
if the text were unknown adds substitutions and loses the strongest alignment input.

## Decision drivers

- Operate one production TTS system and one voice/profile catalog.
- Keep model lifecycle, engine selection and GPU routing outside the NarrativeX worker.
- Reuse a warm model across narration segments without depending on a Desktop UI.
- Keep segment-level timing and retries for one-to-two-hour dubbing workflows.
- Preserve project/account voice-reference scope, integrity and consent boundaries.
- Store a lossless narration master suitable for forced alignment and final rendering.

## Decision

VoiceStudio 0.5.2 is the only production TTS runtime. It runs as a persistent private headless
service. NarrativeX calls its HTTP API and does not import VoiceStudio model code or start a model
for each sentence.

The existing neutral `TtsProvider` protocol remains the orchestration boundary; its only
production implementation is `VoiceStudioTtsEngine`. `FakeTtsProvider` remains test-only and is
rejected by production configuration. VieNeu code, dependencies, configuration, catalog rows,
preview tooling and fallback selection are removed.

For a saved system/profile voice, `VoiceStudioTtsEngine` uses the OpenAI-compatible
`POST /v1/audio/speech` endpoint with `response_format=wav`. For a request-scoped PROJECT or ACCOUNT
voice reference, it uses VoiceStudio's native headless `POST /generate` multipart endpoint. The
service URL must be loopback/private/local in production, authentication is configurable, HTTP
redirects are refused, and error bodies are not logged.

Narration execution is:

```text
Qwen3 8B Vietnamese script
  -> sentence-aware NarrativeX segments
  -> VoiceStudio headless TTS, one segment request at a time by default
  -> normalize each response to 48 kHz mono signed 16-bit PCM
  -> concatenate and wrap as the authoritative WAV master
  -> WhisperX forced alignment against the known Vietnamese script
  -> alignment version whisperx-forced-v1
  -> project-local media + PostgreSQL metadata
  -> ASS subtitle/render consumers
```

The Chinese-video dubbing target remains segment-based:

```text
Chinese video -> FFmpeg audio extraction
              -> faster-whisper large-v3 transcript + timestamps
              -> Qwen3 8B duration-aware Vietnamese rewrite
              -> VoiceStudio TTS per segment + duration matching
              -> WhisperX forced alignment
              -> FFmpeg source ducking + Vietnamese voice + subtitle masking/burn
```

This ADR fixes the provider/audio/alignment boundary. It does not claim the video-ingest/dubbing
workflow is already implemented; that remains a separate delivery phase.

On an 8 GB GPU, Qwen, VoiceStudio TTS and video ASR/alignment are scheduled as stages rather than
kept GPU-resident together. VoiceStudio keeps one selected TTS engine resident inside its service
across segment calls. NarrativeX defaults to one Chapter and one VoiceStudio inference at a time.

## Consequences

### Positive

- There is one production TTS adapter, catalog and operational path.
- A VoiceStudio engine/profile can change through configuration without changing narration logic.
- TTS output is lossless WAV and WhisperX receives the exact script instead of an ASR guess.
- Segment synthesis supports bounded retry, reuse and future duration matching.
- VoiceStudio owns model caching and GPU routing; the NarrativeX worker stays lightweight.

### Negative

- Narration now depends on the availability and API compatibility of the private VoiceStudio
  service.
- Request-scoped reference synthesis uses VoiceStudio's native endpoint, which is a narrower
  compatibility surface than its OpenAI-compatible endpoint.
- The WhisperX alignment model adds a worker runtime dependency and model cache.
- Existing disposable pre-production databases must be recreated after the V8 catalog baseline
  changes.

### Risks and mitigations

- **GPU contention:** keep concurrency at one and schedule Qwen, TTS and ASR/alignment stages
  sequentially.
- **Service saturation:** VoiceStudio `429`/`5xx` responses are retryable; rejected input fails
  permanently.
- **Output drift during engine changes:** pin `VOICESTUDIO_MODEL` per deployment and regenerate a
  Chapter when the selected engine/profile changes.
- **Licensing:** review VoiceStudio's AGPL terms and the selected engine/model license before
  distribution or commercial use; engine selection is not a license grant.
- **Voice consent:** retain explicit consent, tenant isolation, restricted retention and deletion
  handling for real-person references.

## Supersedes

This ADR supersedes ADR-0025 wherever it leaves the TTS engine, 14B/24 GB hardware profile or
post-TTS alignment implementation open. ADR-0022 continues to govern PROJECT versus ACCOUNT
voice-reference storage.

## References

- VoiceStudio local API and architecture: <https://github.com/debpalash/VoiceStudio>
- VoiceStudio Docker/headless deployment: <https://github.com/debpalash/VoiceStudio/blob/main/docs/install/docker.md>
- WhisperX forced-alignment API: <https://github.com/m-bain/whisperX>
