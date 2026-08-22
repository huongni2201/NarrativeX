# NarrativeX V1.11 — Current Feature Catalog

This is the maintained V1.11 feature/status view. [`FEATURE_CATALOG.md`](FEATURE_CATALOG.md) retains historical V1.8 requirement IDs for traceability and must not be read as current implementation status.

| Feature | V1.11 status | Current direction |
|---|---|---|
| Project/Chapter authoring | IMPLEMENTED foundation | MyBatis Project + Chapter persistence |
| Project dashboard/favorite | IMPLEMENTED foundation | authoritative dashboard/favorite API + frontend wiring |
| Chapter Analyze | IMPLEMENTED | durable admission/job/provider/reconciliation |
| Generation durability persistence | IMPLEMENTED for covered boundaries | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox enqueue/Job History on MyBatis/explicit SQL; Chapter Analyze has no internal pre-moderation gate |
| Character/Location continuity | IMPLEMENTED foundation | complete human review/reference lock still PARTIAL |
| Project Character list/detail | IMPLEMENTED foundation | project-scoped authoritative read model wired end to end |
| Storyboard/VisualBeat | IMPLEMENTED foundation | approved revision/reset workflow PARTIAL |
| Backend MediaPlan authority | IMPLEMENTED foundation | immutable revision + resolved motion policy |
| TTS narration + alignment | IMPLEMENTED foundation | R2-backed immutable narration |
| User-provided narration | IMPLEMENTED foundation | ordered parts, multi-Chapter logical timeline, TTS bypass; production upload/finalize hardening PARTIAL |
| R2 durable media topology | IMPLEMENTED | sole durable media object store |
| MyBatis convergence | PARTIAL | generation durability + ProviderOperation/Chapter/Project migrated; StoryVersion, quota/billing, storyboard/continuity and other boundaries remain |
| VisualScenePlanner | TARGET | narration-timeline-driven adaptive scenes |
| Production image generation | TARGET | first slice may use GENERATE_NEW only |
| Immutable image MediaAsset lifecycle | TARGET | required before renderer completion |
| IMAGE_MOTION render/export | TARGET | first complete long-form MP4 path |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow | cost/consistency optimization after first MP4 |
| HYBRID_LOCAL_I2V | DEFERRED fast-follow | selected-beat private I2V only |
| Full actual-cost reconciliation | PARTIAL | estimate/reservation/actual usage remain distinct |
| Public-production moderation/retention/DR/observability | PARTIAL | release-blocking evidence remains |

The outbox dispatcher's short-lived JDBC claim/lease query remains an intentional operational exception; it is not the durable enqueue authority.

## V1.11 narration acceptance

`USER_PROVIDED_AUDIO` may be one file for many Chapters or several ordered files. The system must create one aligned global narration timeline and must not schedule/reserve TTS for the covered scope.

## V1.11 first-video acceptance

A selected Chapter scope can consume TTS or user-provided narration, build narration-driven visual scenes, generate immutable R2-backed images, render deterministic IMAGE_MOTION and produce a validated R2-backed FinalArtifact.
