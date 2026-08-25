# NarrativeX Data Flow and Durability Model — V1.11

PostgreSQL state, not Redis messages, renderer memory or process memory, determines what NarrativeX believes happened. Desktop project bytes are local-first but durable business/execution identity remains backend-owned.

## Authority matrix

| Concern | Authority | Notes |
|---|---|---|
| Project/StoryVersion/Chapter/storyboard/continuity | PostgreSQL | ownership/versioning apply |
| GenerationJob/StageAttempt/ProviderOperation | PostgreSQL | Redis/process memory may carry hints only |
| MediaPlan / production policy | PostgreSQL | worker/device executes persisted authorized state |
| Narration document/set/timeline metadata | PostgreSQL | source/narration fingerprints pin inputs |
| Desktop project byte locations | local `project.manifest.json` | project-relative paths + size/SHA-256; not domain authority |
| Desktop final MP4 bytes | local project `artifacts/` | backend stores `LOCAL_DESKTOP` + opaque artifact identity/metadata |
| Cloud pipeline media bytes | Cloudflare R2 | retained cloud/legacy path |
| Cloud final MP4 bytes | Google Drive | retained cloud/legacy path |
| Server-managed session (OAuth callback/Desktop API) | Redis via Spring Session | availability dependency, not business-state authority |
| Local-execution device credential | Electron protected storage | machine credential, not user session identity |

## Desktop authentication

```text
Electron main
  -> system browser /api/v1/auth/desktop/start
  -> Google OIDC
  -> narrativex://auth/callback?code=<one-time-code>
  -> backend /api/v1/auth/desktop/exchange
  -> server-managed NarrativeX session
```

Google tokens never enter Electron. The device token used for local execution is a separate credential.

## Chapter Analyze

```text
persisted Chapter
  -> lock/reload authoritative snapshot
  -> admission + reservation/policy
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker claim/lease/heartbeat
  -> ProviderOperation when applicable
  -> validated structured result
  -> stale-snapshot re-check
  -> continuity/storyboard materialization
```

## Narration selection

```text
NarrationStrategy.TTS
  -> TTS execution
  -> AUDIO_ALIGN

NarrationStrategy.USER_PROVIDED_AUDIO
  -> validate/register audio
  -> AUDIO_ALIGN
  -> no TTS for covered scope
```

User-provided parts are ordered on one logical audio clock. File boundaries do not define Chapter boundaries.

For Desktop local rendering, narration bytes must be present in the project workspace and registered in the local manifest. Cloud R2-backed narration remains a compatibility path while generation/import materialization migration is incomplete.

## Image execution

```text
pinned authorized image work
  -> Vertex/provider execution
  -> validate image bytes
  -> stable MediaAsset identity + checksum
  -> materialize according to execution mode
```

Desktop target:

```text
validated image
  -> local project assets/images
  -> project.manifest.json
  -> local render resolves mediaAssetId + checksum
```

Cloud/legacy target:

```text
validated image
  -> immutable R2 object
  -> cloud render/pipeline metadata
```

## Desktop local project render flow

```text
backend admits + assigns LOCAL_DEVICE render
  -> authorized device claims job + lease
  -> claim returns narration/image asset IDs + expected integrity
  -> Electron main resolves assets through project.manifest.json
  -> reject missing/size/checksum/path-boundary mismatch
  -> build local render manifest
  -> FFmpeg render segments
  -> concatenate video
  -> concatenate narration
  -> mux
  -> ffprobe final MP4
  -> register checksum-verified artifact locally
  -> report progress/completion to backend
  -> backend records LOCAL_DESKTOP + opaque relative artifact key
```

A lease heartbeat runs during rendering. Lease loss aborts the render. In-process cancellation exists. Restart-safe recovery/resume remains partial.

## Local project artifact metadata

The backend must be able to identify a local artifact without storing the absolute machine path. Typical completion metadata includes:

```text
storageProvider = LOCAL_DESKTOP
storageKey = <opaque project-relative artifact key>
renderFingerprint
checksumSha256
sizeBytes
durationMs
width
height
fps
```

Electron's manifest/path resolver maps the opaque local identity back to the actual machine path.

## Retained cloud render flow

The older cloud/server path remains valid during migration:

```text
cloud render job
  -> READY R2 inputs
  -> worker FFmpeg/ffprobe
  -> Google Drive final upload
  -> FinalArtifact provider metadata
  -> terminal backend job state
```

Drive resumable upload/idempotent fingerprint lookup remain cloud-path concerns. This path is a fallback and must not redefine Desktop storage.

## Current gaps

- complete local materialization of all image/TTS/import result paths;
- restart-safe local render recovery/resume;
- automatic device registration if explicit pairing is removed;
- remaining Desktop editor/review workflow completeness;
- local disk cleanup/backup/move/repair UX;
- narration-driven VisualScenePlanner/review;
- richer image approval/reuse/reframe/edit lineage;
- complete cost/usage reconciliation and production observability/retention/DR evidence.
