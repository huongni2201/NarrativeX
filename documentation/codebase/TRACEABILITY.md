# Current implementation traceability — V1.11

This codebase-level matrix is a compact implementation view. The canonical contract is `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`; the primary capability/evidence matrix is `../TRACEABILITY.md`. Code, migrations, contracts, tests and accepted ADRs are authoritative for AS-IS status.

## High-level status

The Chapter Analysis vertical slice is an implemented foundation:

- Project metadata creation plus dashboard/favorite reads.
- Chapter persistence and source snapshots.
- Explicit Chapter Analyze.
- Admission controls.
- Durable GenerationJob / StageAttempt / OperationPlan / outbox pipeline.
- Worker claim/lease/heartbeat.
- Durable ProviderOperation lifecycle foundation.
- Character/Location/Scene/VisualBeat materialization and Scene continuity relations.
- Project-scoped Character list/detail read models wired to the frontend.

Production media readiness gaps remain explicitly tracked.

| Area | Current status |
|---|---|
| Authentication | IMPLEMENTED foundation: Spring Security session, CSRF, password auth and Google OIDC |
| Project/Chapter lifecycle | IMPLEMENTED foundation |
| Project dashboard/favorite | IMPLEMENTED foundation |
| Chapter Analyze enqueue | IMPLEMENTED |
| Safety/entitlement/quota/cost admission | IMPLEMENTED MVP foundation |
| ProviderOperation durability | IMPLEMENTED foundation with SQL/CAS/reconciliation/result-fingerprint invariants |
| Generation persistence | IMPLEMENTED for covered durability boundaries: GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox enqueue/Job History/safety gate on MyBatis/explicit SQL |
| Worker concurrency | IMPLEMENTED bounded concurrency |
| Storyboard persistence | IMPLEMENTED foundation; broader approved reset/version editing remains partial |
| Character continuity | IMPLEMENTED foundation: Character/ProjectCharacter/CharacterVersion + Scene relations; full reference locking/review remains partial |
| Location continuity | IMPLEMENTED foundation: project Location materialization + Scene references; richer review/reference workflow remains partial |
| Frontend API integration | IMPLEMENTED foundation across core project/chapter/storyboard flows; project Character list/detail is real-API-backed |
| TTS narration/alignment | IMPLEMENTED foundation with R2-backed durable narration |
| User-provided narration | IMPLEMENTED planning/timeline foundation; production upload/finalize/alignment hardening remains partial |
| Image generation / render / export | TARGET for first complete durable MP4 vertical slice |
| Complete MyBatis migration | PARTIAL: StoryVersion, quota/billing, storyboard/continuity and other migration-era boundaries remain |

## Durable generation contract

```text
request
 -> ownership + locked authoritative snapshot
 -> admission
 -> OperationPlan
 -> GenerationJob
 -> StageAttempt
 -> OutboxEvent
 -> worker claim
 -> ProviderOperation
 -> provider/local execution
 -> validated materialization
```

The durable generation boundaries above use MyBatis/explicit SQL where recorded in ADR-0015. The outbox dispatcher retains a deliberate `JdbcTemplate` claim/lease query for its short-lived operational lease concern.

## Remaining production gaps

1. Production user-audio upload/finalize and alignment hardening.
2. Narration-driven VisualScenePlanner.
3. Production image generation plus immutable R2 image MediaAsset lifecycle.
4. IMAGE_MOTION render/export plus validated R2 FinalArtifact.
5. Approved storyboard reset/versioning and full Character reference-lock/review workflows.
6. Complete billing ledger and actual provider/GPU usage reconciliation.
7. Remaining MyBatis convergence for StoryVersion, quota/billing, storyboard/continuity and low-risk CRUD/query boundaries.
8. Production moderation/SSRF/retention/observability/restore evidence.
