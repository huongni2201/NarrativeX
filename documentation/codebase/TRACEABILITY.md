# Current implementation traceability

This matrix distinguishes V1.10 source-of-truth intent from factual repository implementation. Code, migrations, contracts and accepted ADRs are authoritative for AS-IS status.

## High-level status

The Chapter Analysis vertical slice is implemented foundation:

- Project metadata creation.
- Chapter persistence and source snapshots.
- Explicit Chapter Analyze.
- Admission controls.
- Durable GenerationJob pipeline.
- Worker claim/lease/heartbeat.
- Durable ProviderOperation lifecycle foundation.
- Character/Scene/VisualBeat materialization.

Production readiness gaps remain explicitly tracked.

| Area | Current status |
|---|---|
| Authentication | IMPLEMENTED foundation: Spring Security session, CSRF, password auth and Google OIDC |
| Project/Chapter lifecycle | IMPLEMENTED foundation |
| Chapter Analyze enqueue | IMPLEMENTED |
| Safety/entitlement/quota/cost admission | IMPLEMENTED MVP foundation |
| ProviderOperation durability | IMPLEMENTED foundation; reconciliation workflow continues to mature |
| Worker concurrency | IMPLEMENTED bounded concurrency |
| Storyboard persistence | IMPLEMENTED foundation |
| Character continuity | PARTIAL: Character entities exist, Scene relations still incomplete |
| Location continuity | PARTIAL: domain support exists, AI materialization pending |
| Frontend API integration | PARTIAL: Chapter/Storyboard connected, several library screens pending |
| Image/TTS/render/export | NOT CURRENT VERTICAL SLICE |

## Durable generation contract

```text
request
 -> ownership + snapshot validation
 -> admission
 -> OperationPlan
 -> GenerationJob
 -> StageAttempt
 -> OutboxEvent
 -> worker claim
 -> ProviderOperation
 -> provider
 -> materialization
```

## Remaining production gaps

1. AI-returned Location materialization.
2. Scene -> ProjectCharacter and Scene -> Location relation persistence.
3. Approved storyboard reset/versioning.
4. Complete billing ledger and actual provider usage reconciliation.
5. Full media generation/render pipeline.
6. Production observability, restore testing and deletion lifecycle.
