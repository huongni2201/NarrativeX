# NarrativeX Data Flow and Durability Model — V1.11

PostgreSQL state, not Redis messages or process memory, determines what NarrativeX believes happened.

## Authority matrix

| Concern | Authority | Notes |
|---|---|---|
| Project/StoryVersion/Chapter/storyboard/continuity | PostgreSQL | ownership and versioning apply |
| GenerationJob/StageAttempt/ProviderOperation | PostgreSQL | Redis may carry hints only |
| MediaPlan / production policy | PostgreSQL | worker executes the persisted authorized revision |
| Narration document/set/timeline metadata | PostgreSQL | source and narration fingerprints pin immutable inputs |
| Durable source/generated/reusable media bytes | Cloudflare R2 | private by default; DB owns metadata/lineage |
| Durable final rendered MP4 bytes | Google Drive | private by default; DB stores provider/external file identity |
| Worker render/media workspace | Local filesystem | ephemeral only; current render output does not survive a completed/stalled worker attempt |
| Browser session | Redis via Spring Session | availability dependency, not business-state authority |

## Chapter Analyze

```text
persisted Chapter
  -> lock/reload authoritative snapshot
  -> admission + atomic reservation
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker claim/lease/heartbeat
  -> ProviderOperation
  -> validated structured result
  -> stale-snapshot re-check
  -> continuity/storyboard materialization
```

## Narration selection

```text
NarrationStrategy.TTS
  -> TTS_GENERATE
  -> AUDIO_ALIGN

NarrationStrategy.USER_PROVIDED_AUDIO
  -> AUDIO_ALIGN
  -> no TTS_GENERATE
```

User-provided parts are ordered and mapped onto one logical global audio clock. One part can cover multiple Chapters; Chapter boundaries come from source/alignment, not file boundaries.

Generated narration and accepted uploaded audio remain R2-backed pipeline media.

## Image execution

```text
pinned media-generation work
  -> Vertex image execution
  -> validate image bytes
  -> immutable R2 image object
  -> MediaAsset / media-generation metadata
  -> READY input for render
```

This production foundation exists. Richer approval/reuse/reframe/edit lineage remains incomplete.

## Current chapter render flow

```text
CHAPTER_RENDER job
  -> load pinned MediaPlan revision
  -> load READY R2 images
  -> load generated narration matching chapterRowVersion + sourceHash
  -> normalize visual timing to narration duration
  -> FFmpeg IMAGE_MOTION in local workspace
  -> ffprobe validation + SHA-256
  -> Google Drive resumable upload
  -> fetch/verify Drive file identity + size
  -> persist render_manifest + FinalArtifact Drive metadata
  -> mark stage/job COMPLETED
```

The current render worker does not yet resolve aligned multi-part `USER_PROVIDED_AUDIO` into a chapter-local audio file. That path remains partial.

## Google Drive upload semantics

Inside one render attempt, Drive upload uses resumable chunks. If a chunk request becomes ambiguous, the adapter queries the resumable session offset and continues from the confirmed byte range.

Before creating a final file, the adapter searches the configured Drive folder by `renderFingerprint`. If an earlier attempt already completed the remote upload, a retry can reuse that Drive file when its size matches instead of creating another copy.

The current local `final.mp4` lives in an ephemeral job workspace. Therefore an upload/storage failure that causes the job to become `STALLED` may lead to a rerender on the next claim. Cross-attempt upload-only retry is a TARGET hardening item, not a current guarantee.

## FinalArtifact storage metadata

```text
storageProvider = GOOGLE_DRIVE
storageKey = gdrive:<driveFileId>
externalFileId = <driveFileId>
webViewLink = <optional UI convenience link>
checksumSha256
sizeBytes
durationMs
width
height
fps
```

The Drive file ID/provider metadata is the durable remote identity. A public/share link is not required for correctness.

## Drive FinalArtifact content flow

Owner-authorized preview/download uses the backend as a streaming proxy. PostgreSQL ownership and
FinalArtifact readiness are checked before the backend refreshes the shared Google Drive OAuth
access token and requests `files/{externalFileId}?alt=media`. A single browser byte range is
forwarded to Drive and the response body is copied to the browser without buffering the MP4 in
memory. The backend returns `206`, `Content-Range`, `Content-Length`, and `Accept-Ranges` for
partial content; `/content` uses inline disposition and `/download` uses attachment disposition.
The legacy `/preview` path remains an alias for inline content delivery.

## Current gaps

- production user-audio upload/finalize/alignment hardening;
- aligned multi-part uploaded-audio slicing/stitching for render;
- complete narration-driven VisualScenePlanner/review loop;
- richer image approval/reuse/reframe/edit lineage;
- cross-attempt Drive upload-only retry without rerender;
- complete actual-usage/billing reconciliation and release/refund behavior;
- full Character/reference and approved-storyboard workflows;
- broader moderation/SSRF/retention/observability/DR evidence.
