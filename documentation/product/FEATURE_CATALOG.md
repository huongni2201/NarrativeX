# NarrativeX — Current Feature Catalog (V1.11)

This is the single maintained feature/status view. Historical requirement identifiers remain traceable through Git history and accepted ADRs; superseded catalogs are not kept beside the current catalog.

| Feature | V1.11 status | Current direction |
|---|---|---|
| Project/Chapter authoring | IMPLEMENTED foundation | MyBatis Project + Chapter persistence |
| Project dashboard/favorite | IMPLEMENTED foundation | authoritative dashboard/favorite API + frontend wiring |
| Chapter Analyze | IMPLEMENTED | durable admission/job/provider/reconciliation |
| Generation durability persistence | IMPLEMENTED | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/Job History explicit SQL/MyBatis |
| Character/Location continuity | IMPLEMENTED foundation | complete human review/reference lock remains PARTIAL |
| Project Character list/detail | IMPLEMENTED foundation | project-scoped authoritative read model wired end to end |
| Character reference assets | IMPLEMENTED foundation | normalized CharacterVersion identity/profile/outfit/pose references are available to image planning |
| Storyboard/VisualBeat | IMPLEMENTED foundation | approved revision/reset workflow PARTIAL |
| Backend MediaPlan authority | IMPLEMENTED foundation | immutable revision + resolved motion policy |
| TTS/VieNeu narration + alignment | IMPLEMENTED foundation | R2-backed immutable narration |
| User-provided narration planning | IMPLEMENTED foundation | ordered parts, multi-Chapter logical timeline, TTS bypass |
| User-provided narration render E2E | PARTIAL | render worker still lacks aligned multi-part audio slicing/stitching |
| R2 pipeline media storage | IMPLEMENTED | images/audio/reusable pipeline media remain in R2 |
| Google Drive final MP4 storage | IMPLEMENTED foundation | resumable upload + fingerprint lookup + FinalArtifact Drive metadata |
| Vertex image generation | IMPLEMENTED foundation | real provider path + durable R2 image assets |
| IMAGE_MOTION chapter render | IMPLEMENTED foundation | dedicated FFmpeg render worker + ffprobe validation |
| Authoritative Chapter media head | IMPLEMENTED | workspace hydration and stale-plan checks resolve the current media identity from PostgreSQL |
| Local device pairing | IMPLEMENTED foundation | paired device capabilities and revocation are persisted for local execution |
| Final MP4 duplicated into R2 | NOT USED | final video is promoted directly to Drive by default |
| Owner-authorized Drive preview/download | IMPLEMENTED | backend-authorized OAuth proxy with preview/download dispositions and HTTP Range |
| Cross-attempt Drive upload-only retry | TARGET hardening | resumable upload is robust within an attempt; local workspace is ephemeral |
| MyBatis-only production persistence | IMPLEMENTED | all production persistence uses MyBatis + explicit SQL |
| VisualScenePlanner | TARGET | narration-timeline-driven adaptive scenes |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow | cost/consistency optimization after reliable creator loop |
| HYBRID_LOCAL_I2V | DEFERRED fast-follow | selected-beat private I2V only |
| Full actual-cost reconciliation | PARTIAL | estimate/reservation/actual usage remain distinct |
| Public-production moderation/retention/DR/observability | PARTIAL | release-blocking evidence remains |

## Storage contract

```text
Generated images        -> R2
Generated narration     -> R2
Accepted uploaded audio -> R2
Reusable pipeline media -> R2
Final rendered MP4      -> Google Drive
```

ADR-0003 governs R2-backed pipeline media and Google Drive final MP4 storage.

## V1.11 narration acceptance

`USER_PROVIDED_AUDIO` may be one file for many Chapters or several ordered files. The planning/timeline model creates one logical narration clock and does not schedule/reserve TTS for the covered scope. The remaining gap is connecting aligned uploaded parts into the current chapter render input path.

## V1.11 current render foundation

A pinned Chapter render can consume READY R2 image assets and a matching generated narration asset, render deterministic `IMAGE_MOTION`, validate the MP4, upload it to Google Drive and persist provider-aware `FinalArtifact` metadata.
