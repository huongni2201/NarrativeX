# Narration and User-Provided Audio Workflow — V1.11

Narration is a first-class timeline consumed by visual planning and rendering. It is not synonymous with TTS.

## Strategy

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

For an accepted user-provided-audio scope, operation planning omits TTS work/reservation for that same scope.

## Generated narration — implemented provider foundation

Generated narration starts from the persisted source identity and is validated/aligned before downstream use.

### Google TTS

```text
persisted Chapter source snapshot
  -> deterministic NarrationRequest
  -> provider operation / reconciliation
  -> validated audio
  -> alignment
  -> materialize according to execution mode
```

Ambiguous external-provider outcomes remain fenced/reconciled before billable resubmission.

### VieNeu

```text
persisted source
  -> sentence-aware segments
  -> local VieNeu inference
  -> concatenate/encode final audio
  -> validate + SHA-256
  -> alignment
  -> materialize according to execution mode
```

VieNeu local inference can be regenerated safely when no external paid side effect occurred. Application quota/concurrency policy may still account for local compute.

## Desktop narration materialization target

For the primary Desktop workflow, narration bytes consumed by local rendering must be registered in the project workspace:

```text
<userData>/projects/<projectId>/assets/audio/
project.manifest.json
```

The manifest maps the backend narration/media identity to a project-relative path, expected size and SHA-256. Electron main resolves/validates the file before rendering.

Absolute local paths are never persisted as backend narration identity.

Cloud R2-backed narration remains a retained compatibility/provider path during migration; it is not the Desktop project-audio target.

## User-provided audio — implemented planning/timeline foundation

```text
selected Chapter/source manifest
  + ordered audio parts (1..N)
  -> validate/register
  -> narration/document fingerprints
  -> one logical global audio clock
  -> alignment spans
  -> alignment status/coverage/confidence
```

One audio part may cover multiple Chapters. Multiple files may cover one Chapter range. File boundaries do not define Chapter boundaries.

## Desktop user-audio import

Primary Desktop flow should use native file selection and local manifest registration:

```text
Electron native picker
  -> validate selected file
  -> copy/register under project assets/audio
  -> SHA-256 + size metadata
  -> backend stores stable asset identity/metadata
  -> alignment planning/execution
```

Do not require a Desktop user to upload project audio to R2 solely so local FFmpeg can consume it.

If the workflow intentionally needs cross-device/shared/cloud access, a separate explicit remote materialization/sync boundary may use cloud storage.

## Current local render integration

The local project-render claim resolves narration by backend asset identity plus expected integrity metadata. Electron main uses `ProjectStorage.resolveAsset(...)` to obtain the actual machine path only inside the trusted main process.

Local project rendering then performs:

```text
local narration input
  + local image inputs
  -> FFmpeg visual segments
  -> video concat
  -> narration concat
  -> mux
  -> ffprobe/checksum
  -> local final artifact
```

Lease heartbeat/progress/completion/failure are reported to the backend.

## Multi-part user-provided audio — remaining E2E work

The durable planning/global-clock model exists, but complete local E2E behavior must prove:

```text
alignment spans
  -> identify relevant ordered parts
  -> calculate part-local ranges
  -> slice ranges when required
  -> concatenate across boundaries
  -> validate one render-scope audio input
  -> register that local input/checksum
  -> LOCAL_DEVICE render
```

Do not claim complete multi-Chapter user-audio → local final-video behavior until this path is implemented and tested.

## Alignment acceptance

Alignment maps source text to global audio time. Preserve at least:

- source identity/version;
- source span;
- global audio start/end;
- confidence;
- coverage/status.

Low confidence, missing coverage, timeline gaps or incompatible source identity must stop for review/fix. NarrativeX must not silently replace accepted user-provided narration with generated TTS.

## Desktop workspace visibility

The Desktop Audio/Voice workspace should display backend-authoritative job/metadata state while resolving playable local files through the preload/main boundary. Renderer code must not receive arbitrary local paths or raw storage credentials.

Cloud-backed playback may continue through authenticated backend access for compatibility where a local copy is not yet materialized.

## Cost behavior

For a `USER_PROVIDED_AUDIO` covered scope:

- TTS character workload = 0;
- no TTS provider operation/reservation for that narration scope;
- validation/alignment/image/render workload may still be accounted separately.

For VieNeu, there may be no external provider charge while application compute/quota policy still applies.

## Storage by execution mode

### Desktop primary

```text
Generated narration       -> local project assets/audio
Accepted uploaded audio   -> local project assets/audio
Generated images          -> local project assets/images
Final local MP4           -> local project artifacts
Metadata/job state        -> PostgreSQL
```

### Cloud/legacy fallback

```text
Cloud narration/audio     -> R2
Cloud images              -> R2
Cloud final MP4           -> Google Drive
Metadata/job state        -> PostgreSQL
```

ADR-0012 governs Desktop local-first project media. ADR-0003 governs the retained cloud path.

## VieNeu machine-local/provider setup

The existing worker/Docker VieNeu path may continue for provider execution during migration. Its output must not force the Desktop project to remain cloud-backed; when a Desktop-local workflow consumes the result, materialize/register the accepted narration into the local project workspace.

GPU/PyTorch execution still requires a GPU-capable runtime/image; toggling only an environment variable is not sufficient when CUDA/PyTorch dependencies are absent.
