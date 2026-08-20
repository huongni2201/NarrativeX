# NarrativeX V1.11 Current Implementation Traceability

This matrix maps the V1.11 contract to repository evidence at the docs-sync base `e47dccee4aa35450f3902a55311d5d83632cb5a6`.

| Capability / invariant | Evidence | Status |
|---|---|---|
| Project creation metadata-only | backend Project commands/APIs | IMPLEMENTED |
| Project MyBatis persistence | MyBatis Project adapters/mappers/query mapping | IMPLEMENTED |
| Chapter source snapshot + MyBatis persistence | Chapter domain/repository + rowVersion/sourceHash tests | IMPLEMENTED |
| Explicit durable Chapter Analyze | generation API/use case | IMPLEMENTED |
| Durable enqueue + outbox | OperationPlan/GenerationJob/StageAttempt/Outbox | IMPLEMENTED foundation |
| Worker claim/lease/heartbeat | PostgreSQL claim/recovery tests | IMPLEMENTED |
| ProviderOperation durable lifecycle | repository/worker lifecycle + reconciliation tests | IMPLEMENTED foundation |
| Completed-result fingerprint immutability | result fingerprint schema/tests | IMPLEMENTED |
| Character + Location continuity and Scene relations | worker materialization/tests | IMPLEMENTED foundation |
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
| Complete MyBatis migration | ProviderOperation/Chapter/Project done; other JPA/JDBC boundaries remain | PARTIAL |
| Complete actual usage/billing reconciliation | reservation foundation exists | PARTIAL |

## Current non-claims

NarrativeX does not yet claim a complete Story/Chapter → production MP4 loop. The next release-critical chain is production user-audio/TTS timeline → VisualScenePlanner → production image generation → immutable MediaAssets → IMAGE_MOTION FFmpeg → validated R2 FinalArtifact.

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
