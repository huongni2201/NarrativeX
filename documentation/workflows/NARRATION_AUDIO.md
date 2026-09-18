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
  -> VieNeu headless/API inference per segment
  -> native speaking-rate adjustment (0.25x–4.0x)
  -> normalize/concatenate 48 kHz mono PCM
  -> WAV master
  -> validate + SHA-256
  -> WhisperX forced alignment against the known script
  -> local project media store
```

The generic `TtsProvider` orchestration contract remains, but production contains only `VieNeuExecutor` on the compute plane. VieNeu is a dedicated runtime; NarrativeX does not import its engine packages, depend on a Desktop UI, or start a model process per sentence.

Narration admission checks system capacity limits and reserves concurrent capacity. It has no monetary estimator, pricing snapshot or local/external pricing branch. Source text and voice capabilities are validated by the generation use case before admission.

## Batch admission and capacity errors

Each chapter request owns its transaction. If capacity is exhausted after one or more chapters were accepted, batch narration stops and returns those accepted jobs. If no chapter was accepted, `CAPACITY_LIMIT` is returned as HTTP 409. The API preserves `CAPACITY_LIMIT` rather than falling back to a generic conflict code.

## Desktop generated-audio workflow

Current Desktop foundations include voice selection/preview, single/batch narration requests, progress/error handling, active-job recovery after reload and local project-media consumption. Preview results are temporary and are not the durable project audio artifact.

Generated/project narration bytes used by final rendering live on the local machine under the configured project-media root and are referenced through stable backend identity plus integrity metadata. PostgreSQL stores logical keys and metadata, never host/container absolute paths.

Before Editor playback, Electron main materializes generated Chapter narration into Desktop ProjectStorage and verifies its size and checksum. The renderer then plays it through the `narrativex-media://` protocol.

## Voice-reference scope

Voice references are explicit scope-bearing selections:

```text
VoiceReferenceScope
  PROJECT
  GLOBAL_LOCAL
```

### PROJECT voice reference

A PROJECT reference is project working media and remains device/project local.

```text
Desktop native picker / existing project AUDIO asset
  -> backend stable project MediaAsset
  -> ProjectStorage commit
  -> project.manifest.json relative path + size + SHA-256
  -> narration request selects { scope: PROJECT, assetId }
  -> executor resolves the immutable project manifest entry
  -> size/checksum verification
  -> temporary VieNeu reference input
```

Missing, stale, unsafe or corrupt manifest data fails closed.

### GLOBAL_LOCAL voice reference

A GLOBAL_LOCAL reference is a reusable local asset stored in the application's reusable voice library.

```text
Desktop native picker (MP3/WAV) / Voice Library manager
  -> checksum + registration into local voice library
  -> durable validation & metadata in local database
  -> READY VoiceReferenceAsset
  -> narration request selects { scope: GLOBAL_LOCAL, assetId }
  -> executor loads from local voice library
  -> temporary VieNeu reference input
```

GLOBAL_LOCAL references require READY state and valid size/SHA-256 integrity metadata.

Generated narration, generated images, imported project media, PROJECT voice references and final render artifacts live in local project media.

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

The compute executor does not own production VisualBeat text-to-audio mapping. Complete persisted beat audio spans may remain compatibility input; provisional fallback timing is review-only and does not make a Chapter render-ready.

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

Generation status delivery is real-time-first: SSE carries job snapshots, Electron main reconnects the stream, and a slow GET watchdog covers missed events. PostgreSQL remains durable authority.

## Resource behavior

For a `USER_PROVIDED_AUDIO` covered scope:

- TTS character workload = 0;
- no TTS compute task/reservation for that narration scope;
- validation/alignment/image/render work may still be accounted separately.

## Storage contract

```text
GLOBAL_LOCAL voice reference     -> local application voice library
PROJECT voice/reference audio    -> local project media
Generated narration              -> local project media
Accepted imported audio          -> local project media
Generated/imported images/video  -> local project media
Character/portrait media         -> local project media
Final MP4                        -> local project artifacts
Metadata/job/artifact state      -> PostgreSQL
```

## Operational diagnostics

Narration job creation is logged in prepared/committed phases. PostgreSQL remains authoritative for whether the job, `NARRATION_TTS` stage attempt and narration operation exist.
