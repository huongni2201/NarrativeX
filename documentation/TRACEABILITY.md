# NarrativeX V1.11 Current Implementation Traceability

This matrix maps the V1.11 contract to repository evidence at the docs-sync base `29122c51a6d113ed7fd4026f7de3f5df75771153`.

| Capability / invariant | Evidence | Status |
|---|---|---|
| Project creation metadata-only | backend Project commands/APIs | IMPLEMENTED |
| Project dashboard/favorite read model | Project dashboard/favorite use cases, MyBatis query adapter, frontend live dashboard | IMPLEMENTED foundation |
| Project MyBatis persistence | MyBatis Project adapters/mappers/query mapping | IMPLEMENTED |
| Chapter source snapshot + MyBatis persistence | Chapter domain/repository + rowVersion/sourceHash tests | IMPLEMENTED |
| Explicit durable Chapter Analyze | generation API/use case | IMPLEMENTED |
| Durable enqueue + outbox | OperationPlan/GenerationJob/StageAttempt/Outbox | IMPLEMENTED foundation |
| Generation durable persistence cutover | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job-history/safety-gate MyBatis mappers + architecture/integration tests | IMPLEMENTED for covered execution boundaries |
| Worker claim/lease/heartbeat | PostgreSQL claim/recovery tests | IMPLEMENTED |
| ProviderOperation durable lifecycle | repository/worker lifecycle + reconciliation tests | IMPLEMENTED foundation |
| Completed-result fingerprint immutability | result fingerprint schema/tests | IMPLEMENTED |
| Character + Location continuity and Scene relations | worker materialization/tests | IMPLEMENTED foundation |
| Project-scoped Character list/detail read model | controller/use cases/MyBatis projection + frontend tab/detail wiring + authorization tests | IMPLEMENTED foundation |
| Backend-authoritative MediaPlan | MediaPlan use case, immutable revision/job pointer, motion resolver | IMPLEMENTED foundation |
| Full-chapter TTS narration + alignment | narration request/assets/alignment + worker execution/tests | IMPLEMENTED foundation |
| R2-backed narration durability | R2 media storage path/config/tests | IMPLEMENTED foundation |
| `NarrationStrategy.USER_PROVIDED_AUDIO` | generation domain enum/plan | IMPLEMENTED foundation |
| Ordered multi-file logical audio clock | narration timeline factory + worker uploaded timeline tests | IMPLEMENTED foundation |
| One audio part can cover multiple Chapters | narration tests | IMPLEMENTED foundation |
| User-audio TTS bypass | `NarrationOperationPlanner` test excludes `TTS_GENERATE` | IMPLEMENTED |
| Production user-audio upload/finalize API + real alignment runtime | foundation exists; complete user-facing durable path not yet proven | PARTIAL |
| VisualScenePlanner driven by narration alignment | no complete production vertical slice | TARGET |
| Production image generation | workflow/ports foundation only | TARGET |
| Immutable image MediaAsset lifecycle | storage/domain foundations; no complete image stage | TARGET |
| IMAGE_MOTION render/export | no complete production MP4 vertical slice | TARGET |
| Reuse/reframe/edit AssetResolver | architecture defined; intentionally postponed | DEFERRED |
| HYBRID_LOCAL_I2V end-to-end | Wan adapter/planning foundation only | DEFERRED fast-follow |
| Complete MyBatis migration | generation execution durability plus ProviderOperation/Chapter/Project migrated; StoryVersion, quota/billing, storyboard/continuity and other JPA/JDBC boundaries remain | PARTIAL |
| Complete actual usage/billing reconciliation | reservation foundation exists | PARTIAL |

## Current non-claims

NarrativeX does not yet claim a complete Story/Chapter → production MP4 loop. The next release-critical chain is production user-audio/TTS timeline → VisualScenePlanner → production image generation → immutable MediaAssets → IMAGE_MOTION FFmpeg → validated R2 FinalArtifact.

Project Character list/detail is now real-API-backed, but this does **not** mean full Character reference locking, relationship graphs, asset aggregation or detailed scene read models are complete.

## Persistence caveat

The durable generation enqueue/execution boundaries listed above use MyBatis/explicit SQL. The outbox dispatcher still deliberately uses `JdbcTemplate` for its short-lived claim/lease query; that residual operational query is not evidence that the durable enqueue boundary remains JDBC-owned.

## Documentation invariants

1. V1.11 is current authority; V1.10 is historical.
2. PostgreSQL is durable authority; Redis generation hints are not.
3. R2 is the only durable media object store.
4. Worker-local paths are never durable assets.
5. `USER_PROVIDED_AUDIO` bypasses TTS for the covered scope.
6. File boundaries are not Chapter boundaries.
7. Backend MediaPlan/motion policy is authoritative.
8. `IMAGE_MOTION` never authorizes I2V.
9. New persistence-heavy backend work converges on MyBatis.
10. Provider `UNKNOWN` reconciles before resubmission and completed results are immutable by fingerprint.
11. Project Character runtime UI uses authoritative project-scoped reads and does not replace unavailable business fields with fixtures.
