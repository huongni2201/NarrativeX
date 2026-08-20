# NarrativeX V1.10 — Domain Model

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`

## Current aggregate boundaries

| Feature | Aggregate roots | Important owned/entities/state |
|---|---|---|
| project | `Project` | `StoryVersion` |
| character | `Character`, `ProjectCharacter` | `CharacterVersion`, appearance/outfit/reference foundations |
| storyboard | `Chapter`, `Scene` | `VisualBeat` |
| generation | `OperationPlan`, `GenerationJob` | `StageAttempt`, `ProviderOperation` |

Chapter and Scene are independent aggregate roots. Project creation is metadata-only; Chapter source persistence is separate from Analyze.

## Current durable analysis relationships

```text
Project
  -> StoryVersion
      -> Chapter
          -> Scene
              -> VisualBeat

User/ownership boundary
  -> Character
      -> CharacterVersion
Project
  -> ProjectCharacter -> Character

Project
  -> ProjectLocation

Scene
  -> SceneCharacter -> ProjectCharacter
  -> Location reference

OperationPlan
  -> GenerationJob
      -> StageAttempt
          -> ProviderOperation
```

The worker uses stable AI keys to map analysis output to durable project Character/Location identities. Scene continuity is persisted using IDs rather than display names.

## Snapshot rules

- Project creation never creates AI/media work.
- Chapter source is persisted before Analyze.
- GenerationJob snapshots the persisted Chapter identity/source state.
- Worker re-checks Chapter `rowVersion`/`sourceHash` before materialization.
- Re-analysis must not destructively replace approved history without an explicit reset/versioning workflow.
- Future generated assets/render artifacts are immutable/versioned outputs rather than mutable overwrite targets.

## Execution state

```text
GenerationJob:
QUEUED -> RUNNING -> COMPLETED | FAILED | CANCELED

ProviderOperation:
RESERVED -> UNKNOWN -> SUBMITTED | RUNNING | COMPLETED | FAILED
SUBMITTED -> RUNNING | UNKNOWN | COMPLETED | FAILED
RUNNING -> UNKNOWN | COMPLETED | FAILED
COMPLETED | FAILED -> terminal
```

`UNKNOWN` is a reconciliation state, not permission to blind-resubmit.

StageAttempt owns worker execution attempt/lease/heartbeat state. Worker process memory is not authoritative.

## Character and continuity semantics

Character is reusable identity. ProjectCharacter represents participation/metadata within a Project. Analysis-time materialization can create/reuse Character and Location identities and Scene relations, but downstream media generation still requires reviewed/versioned Character/reference resolution.

Visual changes such as outfit/appearance should not create a new Character identity. Historical generation output must resolve immutable version/reference snapshots once media generation lands.

## Cost/admission model

OperationPlan is the durable planning/authorization boundary for expensive work. Current Chapter Analyze includes entitlement/quota/cost reservation foundations before enqueue. Complete append-only usage/billing reconciliation and unused reservation release remain partial.

## Safety/privacy

Story/Chapter Analyze/Generate does not require blanket per-story rights attestation. Moderation, report/review/takedown and real-person consent are separate policy concerns.

Provider output is untrusted until schema/domain validation. Provider safety signals are defense-in-depth; application policy remains authoritative.

## Current versus target concepts

Current code contains more schema/domain foundations than the active product vertical slice uses. Treat image/video generation attempts, render/final artifact, Shorts, full billing ledger, advanced consent/deletion and related media entities as `PARTIAL` or `TARGET` unless traceability identifies a complete current workflow.

Do not infer implementation merely because a table/type appears in the consolidated schema.
