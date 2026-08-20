# NarrativeX — Product Specification V1.10

**Status:** maintained product contract  
**Canonical source:** [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md)  
**Implementation evidence:** [`../TRACEABILITY.md`](../TRACEABILITY.md)

## Product definition

NarrativeX is an AI-assisted long-form story video studio. The product is chapter-first, review-first and durable: Project creation is metadata-only, Chapter save persists source, and Analyze is an explicit action.

## Current implementation snapshot

Current repository foundations include:

- Project Overview;
- StoryVersion and Chapter CRUD/import with source hash and optimistic concurrency;
- explicit durable Chapter Analyze;
- safety/entitlement/quota/estimated-cost admission and atomic reservation foundation;
- PostgreSQL outbox plus worker claim/lease/heartbeat/bounded concurrency;
- durable ProviderOperation reservation/submission/UNKNOWN-reconciliation foundation;
- Character/ProjectCharacter/CharacterVersion materialization;
- project-scoped AI Location materialization;
- stable Character/Location AI identity mappings;
- Scene/VisualBeat materialization;
- Scene -> ProjectCharacter and Scene -> Location continuity persistence;
- Storyboard read/review foundations;
- Character, Location, Asset, Job History, Quota and Notification read/API foundations.

Image generation, TTS/subtitles and render/export remain outside the current implemented vertical slice.

## Chapter Analyze contract

```text
persisted Chapter
  -> ownership/snapshot validation
  -> safety + entitlement + quota + cost admission
  -> atomic usage reservation
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker claim/lease/heartbeat
  -> ProviderOperation lifecycle
  -> structured analysis
  -> stale Chapter check
  -> Character + Location continuity
  -> Scene + VisualBeat + Scene relations
  -> terminal durable job state
```

The browser never supplies arbitrary unsaved text as the analysis authority.

## Character and continuity model

Character is reusable identity at its ownership boundary. Projects use ProjectCharacter assignments. Analysis uses stable AI keys and persists mappings to durable project identities; Scene continuity uses durable IDs rather than display names.

The implemented analysis-time continuity foundation does **not** replace the remaining review/version-lock/reference workflow. Downstream media generation must use reviewed/versioned identity/reference snapshots.

## Provider durability

External provider execution requires durable operation state. Current Chapter analysis implements a ProviderOperation foundation with `RESERVED`, `SUBMITTED`, terminal states and `UNKNOWN` reconciliation/restart behavior. Blind resubmission after ambiguous outcome is prohibited.

Complete provider-specific recovery, actual-usage reconciliation and production observability remain hardening work.

## Cost/admission

Current Chapter Analyze admission checks persisted safety state, `storyAnalysis` entitlement, concurrent expensive-job capacity and monthly credits, then reserves estimated usage atomically in PostgreSQL before durable enqueue.

This is not final billing. Remaining target work includes pricing-version snapshots, append-only ledger completion, actual provider usage, unused authorization release/refund and reconfirmation after material scope changes.

## Trust and safety

No blanket per-story rights-attestation checkbox is required for Analyze/Generate. Moderation, copyright report/review/takedown, real-person consent, abuse protection and deletion are separate concerns.

Current admission safety is a foundation, not complete public-production moderation/consent coverage.

## Current versus target media scope

| Capability | Status |
|---|---|
| Chapter analysis | IMPLEMENTED |
| Character/Location analysis continuity | IMPLEMENTED foundation |
| Storyboard/VisualBeat | IMPLEMENTED foundation |
| Character version/reference/lock review | PARTIAL |
| Approved storyboard reset/versioning | PARTIAL |
| Image generation | PENDING |
| TTS/subtitles | PENDING |
| Render/export/FinalArtifact | PENDING |
| Complete billing reconciliation | PARTIAL |

## Product acceptance direction

```text
Chapter Persisted
  -> Analysis Complete
  -> Characters/Continuity Reviewed
  -> Storyboard Approved
  -> Visual Ready
  -> Audio Ready
  -> Render Ready
  -> Final Artifact Valid
```

Before public beta, NarrativeX still needs the downstream media pipeline plus complete billing reconciliation, broader moderation/consent/abuse coverage, deletion/retention, backup/restore, observability and real-provider E2E/recovery evidence.

Detailed feature inventory: [FEATURE_CATALOG.md](FEATURE_CATALOG.md).  
Business invariants: [../domain/BUSINESS_RULES.md](../domain/BUSINESS_RULES.md).
