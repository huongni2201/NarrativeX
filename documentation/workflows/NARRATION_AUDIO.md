# Narration and User-Provided Audio Workflow — V1.12

Narration is a first-class timeline consumed by visual planning and rendering. It is not synonymous with TTS.

## Strategy

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

For an accepted user-provided-audio scope, operation planning omits TTS work/reservation for that scope.

## Generated narration

Generated narration starts from a persisted source identity and is validated/aligned before downstream use.

### VieNeu

```text
persisted source
  -> sentence-aware segments
  -> VieNeu inference
  -> pitch-preserving speaking-rate adjustment (0.25x–2.0x)
  -> concatenate/encode
  -> validate + SHA-256
  -> alignment
  -> local project media store
```

Local/self-hosted inference may have no external provider charge while still consuming application compute/quota policy.

## Desktop generated-audio workflow

Current Desktop foundations include voice selection/preview, single/batch narration requests, progress/error handling, active-job recovery after reload and local project-media consumption. Preview results are temporary and are not the durable project audio artifact.

Generated/project narration bytes used by final rendering live on the local machine under the configured project-media root and are referenced through stable backend identity plus integrity metadata. PostgreSQL stores logical keys and metadata, never host/container absolute paths.

Before Editor playback, Electron main materializes generated Chapter narration into Desktop ProjectStorage and verifies its size and checksum. The renderer then plays it through the `narrativex-media://` protocol.

## Voice-reference scope

Voice references are explicit scope-bearing selections:

```text
VoiceReferenceScope
  PROJECT
  ACCOUNT
```

### PROJECT voice reference

A PROJECT reference is project working media and remains device/project local.

```text
Desktop native picker / existing project AUDIO asset
  -> backend stable project MediaAsset
  -> ProjectStorage commit
  -> project.manifest.json relative path + size + SHA-256
  -> narration request selects { scope: PROJECT, assetId }
  -> worker resolves the immutable project manifest entry
  -> size/checksum verification
  -> temporary VieNeu enrollment input
```

A PROJECT reference must not carry an R2 storage key. Missing, stale, unsafe or corrupt manifest data fails closed.

### ACCOUNT voice reference

An ACCOUNT reference is a reusable authenticated account asset stored in R2.

```text
Desktop native picker (MP3/WAV)
  -> checksum + authenticated voice-reference upload intent
  -> account-scoped R2 key: voices/<account>/...
  -> durable validation
  -> READY account VoiceReferenceAsset
  -> narration request selects { scope: ACCOUNT, assetId }
  -> authorized worker downloads only when selected
  -> temporary VieNeu enrollment input
```

ACCOUNT references require ownership, READY state, valid size/SHA-256 and R2 storage metadata.

R2 is reserved for reusable account-owned voice-reference/custom-voice files. Generated narration, generated images, imported project media, PROJECT voice references and final render artifacts do not use R2.

## User-provided audio import

Desktop local audio import is an explicit native-file flow. Selecting `USER_PROVIDED_AUDIO` must never silently enqueue TTS.

```text
Electron native picker
  -> main inspect/hash
  -> backend stable local media registration
  -> main commit under project assets/audio
  -> manifest relative path + size + SHA-256
  -> narration/alignment metadata
```

Do not upload project audio to R2 solely so local FFmpeg can consume it.

## Logical audio clock

```text
selected source scope
  + ordered audio parts (1..N)
  -> fingerprints
  -> one logical global audio clock
  -> source-to-audio alignment spans
  -> coverage/confidence/status
```

One audio part may cover multiple Chapters. Several parts may cover one Chapter range. File boundaries do not define Chapter boundaries.

Alignment must preserve source identity/version, source span, global audio start/end, confidence and coverage/status. Low-confidence, missing or source-incompatible alignment must stop for review/fix rather than silently substituting generated narration.

## Visual timing handoff

Narration alignment is consumed by the production timeline through source-anchored VisualBeat text ranges:

```text
VisualBeat textStart/textEnd
  + narration/subtitle alignment spans
  -> backend NarrationTextClockMapper
  -> exact VisualBeat audio clock
```

The narration worker does not own production VisualBeat text-to-audio mapping. Complete persisted beat audio spans may remain compatibility input; provisional fallback timing is review-only and does not make a Chapter render-ready.

## Local render integration

```text
local narration input
  + exact narration-aligned beat clock
  + selected local beat media
  -> visual segments
  -> concat video
  -> concat narration
  -> mux subtitles where available
  -> ffprobe/checksum
  -> local final artifact
  -> backend final-artifact metadata
```

Render execution remains backend-assigned and lease-controlled. Final MP4 playback/export reads the local artifact directly.

Generation status delivery is real-time-first: authenticated SSE carries job snapshots, Electron main reconnects the stream, and a slow GET watchdog covers missed events. PostgreSQL remains durable authority.

## Cost behavior

For a `USER_PROVIDED_AUDIO` covered scope:

- TTS character workload = 0;
- no TTS provider operation/reservation for that narration scope;
- validation/alignment/image/render work may still be accounted separately.

## Storage contract

```text
ACCOUNT voice/reference audio    -> account-scoped R2
PROJECT voice/reference audio    -> local project media
Generated narration              -> local project media
Accepted imported audio          -> local project media
Generated/imported images/video  -> local project media
Character/portrait media         -> local project media
Final MP4                        -> local project artifacts
Metadata/job/artifact state      -> PostgreSQL
```

There is no project-media R2 fallback, dual write or legacy R2 read path in the pre-deployment hard cutover.

## Operational diagnostics

Narration job creation is logged in prepared/committed phases. PostgreSQL remains authoritative for whether the job, `NARRATION_TTS` stage attempt and narration operation exist.

Workers verify their database identity at startup and poll/claim durable PostgreSQL work directly. No Redis or notification channel is required for narration queue discovery.
