# Narration and User-Provided Audio Workflow — V1.11

Narration is a first-class timeline consumed by visual planning and rendering. It is not synonymous with TTS.

## Strategy

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

## TTS path — implemented foundation

```text
persisted Chapter source snapshot
  -> deterministic narration request
  -> TTS provider execution
  -> durable narration segments/final audio
  -> validate
  -> Cloudflare R2
  -> immutable narration metadata
  -> alignment spans
```

Generated full-chapter narration uses an ephemeral per-job scratch workspace:

```text
TTS response (one segment)
  -> segment PCM scratch file + immutable R2 segment
  -> chunked file concatenation
  -> FFmpeg input/output scratch files
  -> streaming SHA-256
  -> file-backed immutable R2 upload
  -> PostgreSQL NarrationAsset
  -> workspace cleanup
```

The production path does not aggregate chapter PCM or MP3 into Python `bytes`; local files are
ephemeral and never authoritative. Recovery downloads durable segment objects to scratch files and
rebuilds the final asset without invoking TTS again.

## VieNeu-TTS local provider

The worker supports a local VieNeu-TTS v3 Turbo adapter through `TTS_PROVIDER_MODE=vieneu`.
Preset voices returned by VieNeu's `list_preset_voices()` are ready to use and do not require a
reference file. NarrativeX also supports a system-wide configured voice profile, including the
global Vietnamese `Ngọc Huyền v2` voice:

```text
VIENEU_REFERENCE_AUDIO_PATH=/path/to/ngoc_huyen_v2_3_8s.wav
  -> Vieneu.add_voice("Ngọc Huyền v2", reference, denoise=true)
  -> save_voices()
  -> Vieneu.infer(text, voice="Ngọc Huyền v2")
  -> float waveform -> 16-bit mono PCM @ 48 kHz
  -> existing durable segment/recovery pipeline
```

`VIENEU_REFERENCE_AUDIO_PATH` is required when registering a non-preset global voice. The source
WAV and the SDK-generated voice profile must not be committed to git or placed in a client-
controlled job payload. For Docker, mount the host-only WAV read-only and set the worker variable
to the container path. The local provider maps catalog id `vieneu-ngoc-huyen-v2` to the SDK voice
name `Ngọc Huyền v2`; other built-in VieNeu voices are resolved from `list_preset_voices()` in
the same way. The web narration modal selects the global catalog voice by default.

VieNeu v3 Turbo does not expose NarrativeX's `speakingRate` setting, so requests for this provider
must use `speakingRate=1.0`. Emotion cues such as `[cười]` remain in the trusted narration input
boundary and are forwarded to VieNeu. Local execution has no external provider character charge;
durable storage and product quota policy remain authoritative in the backend.

### Optional user-provided VieNeu reference

The backend and worker still support an optional MP3 reference for custom voice-cloning callers.
The standard Generate Narration modal uses the configured global catalog voice directly and does
not upload a reference file:

```text
browser checks duration 3–8 seconds and accepts .mp3
  -> existing AUDIO upload intent -> private R2 -> READY media asset
  -> narration request stores voice_reference_asset_id
  -> worker downloads to ephemeral job workspace
  -> pydub AudioSegment.from_mp3(...)
  -> clip to at most 8 seconds -> set_channels(1) -> export WAV
  -> Vieneu.infer(..., ref_audio=temporary_wav)
```

The browser check is only user feedback. The worker re-validates the MP3, rejects samples shorter
than 3 seconds, and performs the conversion with FFmpeg available in the worker image. The uploaded
sample is never copied into a job payload, never registered in a shared worker voice profile, and is
removed with the ephemeral workspace after the job. Only the owning user may attach the READY asset.

When the reference is a real person's voice, explicit consent, tenant isolation, restricted
retention and deletion handling are required before enabling the profile.

## User-provided audio path — implemented planning/timeline foundation

```text
selected Chapter revision/source manifest
  + ordered audio parts (1..N)
  -> narration/document fingerprints
  -> one logical global audio clock
  -> alignment spans
  -> alignment status/coverage/confidence
  -> VisualScenePlanner
```

One audio part may cover multiple Chapters. Multiple files may cover one Chapter range. Part/file boundaries do not determine Chapter boundaries.

The implemented planner proves:

```text
USER_PROVIDED_AUDIO
  -> CHAPTER_ANALYZE
  -> AUDIO_ALIGN
  -> VISUAL_PLAN
  -> IMAGE_GENERATE
  -> MOTION
  -> RENDER
```

There is no `TTS_GENERATE` stage for that covered scope.

## Production upload/finalize target

The user-facing durable boundary must be:

```text
backend authorizes private R2 key / upload
  -> client uploads audio
  -> finalize
  -> validate media type + decode + duration + size
  -> checksum
  -> persist immutable MediaAsset metadata
  -> accept narration part
  -> align
```

Unsupported/corrupt audio fails before alignment/rendering. Originals remain immutable; optional normalized/derived media is a new asset with source lineage.

## Alignment acceptance

Alignment maps selected source text to global audio time. At minimum track:

```text
chapter/source span
textStart / textEnd
globalAudioStartMs / globalAudioEndMs
confidence
coverage/status
```

Low confidence, missing text coverage, detected gaps or incompatible source identity must stop execution for review/fix. Do not silently generate replacement TTS.

## Cost behavior

## Chapter Workspace visibility

Submitting a TTS request returns a durable `QUEUED` generation job. The Chapter Workspace keeps
the Audio tab available while the job is queued or running, but disables only the action that
would submit a duplicate generation request. The workspace polls the durable projection until it
becomes terminal. Once a `NarrationAsset` is materialized, the backend returns a short-lived
private R2 download URL for the Audio player; the storage key and provider credentials are never
sent to the browser.

For a `USER_PROVIDED_AUDIO` covered scope:

- TTS character workload = 0;
- no TTS reservation/provider operation;
- storage, normalization/alignment, image, motion and render workload may still be billed/accounted.
