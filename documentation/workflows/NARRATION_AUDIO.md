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

Current Desktop foundations include voice selection/preview, custom voice-reference upload, single/batch narration requests, progress/error handling, active-job recovery after reload and local project-media consumption. Preview results are temporary and are not the durable project audio artifact.

The Chapter Workspace response also carries the voice ID from the latest persisted narration request. Desktop uses that ID to label the generated audio player, so changing the voice selector for a future generation does not rename an existing narration.

The preview contract is asynchronous: Desktop submits `POST /api/v1/projects/{projectId}/voice-preview-jobs`, observes the job through the shared generation status stream, then reads `GET /api/v1/projects/{projectId}/voice-preview-jobs/{jobId}/result`. Uploaded custom voice references are account-owned R2 assets and remain subject to ownership, readiness and voice-capability checks.

Generated/project narration bytes used by final rendering live on the local machine under the configured project-media root and are referenced through stable backend identity plus integrity metadata. PostgreSQL stores logical keys and metadata, never host/container absolute paths.

## Custom voice reference storage

Custom voice references are reusable account assets rather than project working media.

```text
Desktop native picker (MP3/WAV)
  -> checksum + authenticated voice-reference upload intent
  -> account-scoped R2 key: voices/<account>/...
  -> durable voice-reference validation
  -> READY account asset
  -> narration worker downloads only when selected
  -> temporary WAV enrollment for VieNeu
```

R2 is reserved for these account-owned voice-reference/custom-voice files. Generated narration, generated images, imported project media and final render artifacts do not use R2.

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

## Local render integration

```text
local narration input
  + selected local beat media
  -> visual segments
  -> concat video
  -> concat narration
  -> mux
  -> ffprobe/checksum
  -> local final artifact
  -> backend final-artifact metadata
```

Render execution remains backend-assigned and lease-controlled. Final MP4 playback/export reads the local artifact directly.

Generation status delivery is real-time-first: authenticated SSE carries job snapshots, Electron main reconnects the stream, and a slow GET watchdog covers missed events. A reload can recover the active chapter narration job from the persisted workspace/job state; the stream is a delivery optimization, not durable authority.

## Cost behavior

For a `USER_PROVIDED_AUDIO` covered scope:

- TTS character workload = 0;
- no TTS provider operation/reservation for that narration scope;
- validation/alignment/image/render work may still be accounted separately.

## Storage contract

```text
Custom voice/reference audio      -> account-scoped R2
Generated narration              -> local project media
Accepted imported audio          -> local project media
Generated/imported images/video  -> local project media
Character/portrait media         -> local project media
Final MP4                        -> local project artifacts
Metadata/job/artifact state      -> PostgreSQL
```

There is no project-media R2 fallback, dual write or legacy R2 read path in the pre-deployment hard cutover.

## Operational diagnostics

Narration job creation is logged in two phases: `Prepared narration job` inside the backend transaction and `Committed narration job` only after commit. PostgreSQL remains authoritative for whether the job, `NARRATION_TTS` stage attempt and narration operation exist.

Workers verify their database identity at startup and poll/claim durable PostgreSQL work directly. No Redis or notification channel is required for narration queue discovery.
