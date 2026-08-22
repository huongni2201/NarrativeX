# NarrativeX — Current Feature Catalog (V1.11)

This is the single maintained feature/status view. Historical requirement identifiers remain traceable through Git history and accepted ADRs; superseded catalogs are not kept beside the current catalog.

| Feature | V1.11 status | Current direction |
|---|---|---|
| Project/Chapter authoring | IMPLEMENTED foundation | MyBatis Project + Chapter persistence |
| Project dashboard/favorite | IMPLEMENTED foundation | authoritative dashboard/favorite API + frontend wiring |
| Chapter Analyze | IMPLEMENTED | durable admission/job/provider/reconciliation |
| Generation durability persistence | IMPLEMENTED for covered boundaries | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox enqueue/Job History/safety gate on MyBatis/explicit SQL |
| Character/Location continuity | IMPLEMENTED foundation | complete human review/reference lock still PARTIAL |
| Project Character list/detail | IMPLEMENTED foundation | project-scoped authoritative read model wired end to end |
| Storyboard/VisualBeat | IMPLEMENTED foundation | approved revision/reset workflow PARTIAL |
| Backend MediaPlan authority | IMPLEMENTED foundation | immutable revision + resolved motion policy |
| TTS narration + alignment | IMPLEMENTED foundation | R2-backed immutable narration |
| User-provided narration | IMPLEMENTED foundation | ordered parts, multi-Chapter logical timeline, TTS bypass; production upload/finalize hardening PARTIAL |
| R2 durable media topology | IMPLEMENTED | sole durable media object store |
| MyBatis-only production persistence | IMPLEMENTED | all production persistence uses MyBatis + explicit SQL; architecture tests prevent JPA/`JdbcTemplate` regression |
| VisualScenePlanner | TARGET | narration-timeline-driven adaptive scenes |
| Production image generation | TARGET | first slice may use GENERATE_NEW only |
| Immutable image MediaAsset lifecycle | TARGET | required before renderer completion |
| IMAGE_MOTION render/export | TARGET | first complete long-form MP4 path |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow | cost/consistency optimization after first MP4 |
| HYBRID_LOCAL_I2V | DEFERRED fast-follow | selected-beat private I2V only |
| Full actual-cost reconciliation | PARTIAL | estimate/reservation/actual usage remain distinct |
| Public-production moderation/retention/DR/observability | PARTIAL | release-blocking evidence remains |

The outbox dispatcher claim/lease path uses a dedicated MyBatis mapper.

## V1.11 narration acceptance

`USER_PROVIDED_AUDIO` may be one file for many Chapters or several ordered files. The system must create one aligned global narration timeline and must not schedule/reserve TTS for the covered scope.

## V1.11 first-video acceptance

A selected Chapter scope can consume TTS or user-provided narration, build narration-driven visual scenes, generate immutable R2-backed images, render deterministic IMAGE_MOTION and produce a validated R2-backed FinalArtifact.
