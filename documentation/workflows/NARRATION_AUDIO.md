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
  -> remote generated-media transport when required
  -> Desktop materialization for local use
```

Local/self-hosted inference may have no external provider charge while still consuming application compute/quota policy.

## Desktop generated-audio workflow

Current Desktop foundations include voice selection/preview, custom voice-reference upload, single/batch narration requests, progress/error handling, active-job recovery after reload and local materialization of accepted narration results used by the project. Preview results are returned through an expiring URL and are not the durable project audio artifact.

The Chapter Workspace response also carries the voice ID from the latest persisted narration request. Desktop uses that ID to label the generated audio player, so changing the voice selector for a future generation does not rename an existing narration.

The preview contract is asynchronous: Desktop submits `POST /api/v1/projects/{projectId}/voice-preview-jobs`, observes the job through the shared generation status stream, then reads `GET /api/v1/projects/{projectId}/voice-preview-jobs/{jobId}/result`. The backend returns a signed/temporary result URL with an expiry and duration metadata. Uploaded references remain subject to ownership, readiness and voice-capability checks.

Generated/project narration bytes used by final rendering live under the project workspace and are referenced through stable backend identity plus manifest integrity metadata. Absolute paths remain inside Electron main.

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

Do not upload project audio to R2 solely so local FFmpeg can consume it. R2 is only for generated-media transport when remote provider/worker execution requires it.

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
AI-generated narration transport -> R2 only while remote durability is needed
Generated narration              -> local project assets/audio after materialization
Accepted imported audio          -> local project assets/audio
Generated/imported media         -> local project assets
Final MP4                        -> local project artifacts
Metadata/job/artifact state      -> PostgreSQL
```

## Operational diagnostics

Narration job creation is logged in two phases: `Prepared narration job` inside the backend transaction and `Committed narration job` only after commit. PostgreSQL remains authoritative for whether the job, `NARRATION_TTS` stage attempt and narration operation exist.

Workers verify their database identity at startup and poll/claim durable PostgreSQL work directly. No Redis or notification channel is required for narration queue discovery.
