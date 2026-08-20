# NarrativeX V1.10 — Business Rules

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`
**Rule-ID note:** existing BR identifiers are retained for traceability even when they originated in earlier specifications.

## Core lifecycle

- **BR-01** Project creation is metadata-only; it never implicitly enqueues Analyze/Image/TTS/Render work.
- **BR-02** Chapter source is persisted before Analyze. Unsaved browser text is not AI authority.
- **BR-03** Analyze is an explicit Chapter action and uses a persisted `chapterId + rowVersion + sourceHash` snapshot.
- **BR-04** PostgreSQL is authoritative for durable business/generation state.
- **BR-05** Redis generation delivery/progress is non-authoritative; lost hints must not lose durable work.
- **BR-06** Long-running AI/media work is asynchronous.

## Character and continuity

- **BR-20** Character is reusable identity; Project participation is represented by ProjectCharacter.
- **BR-21** Visual appearance/outfit changes do not create a new Character identity.
- **BR-22** Analysis continuity uses stable AI keys and durable IDs, never display names as foreign-key semantics.
- **BR-23** AI-returned Locations are materialized/reused as project-scoped Location identities.
- **BR-24** Scene character participation is persisted as Scene -> ProjectCharacter relations.
- **BR-25** Scene Location continuity is persisted as a durable Location reference.
- **BR-26** Distinct AI identity keys must not silently collapse to one project identity in a single response.
- **BR-27** Downstream media generation must resolve reviewed/versioned Character/reference snapshots; analysis-time identity matching alone is insufficient for deterministic generation.

## Storyboard/history

- **BR-30** Chapter and Scene are independent aggregate roots.
- **BR-31** VisualBeat is a Scene-owned child entity/generation planning unit.
- **BR-32** Re-analysis must not destructively replace approved Scene/VisualBeat history without an explicit reset/versioning workflow.
- **BR-33** Regeneration creates new attempts/artifacts rather than overwriting immutable approved history.
- **BR-34** When source-preserving narration is selected, persisted Chapter source is narration content authority and TTS must not rewrite it.
- **BR-35** Narration/alignment timing is visual-timeline authority; visual-scene duration is adaptive rather than a fixed sentence/image duration.
- **BR-36** Media planning supports `IMAGE_MOTION` and `HYBRID_LOCAL_I2V`; production-mode changes reuse a still-valid semantic analysis snapshot when analysis inputs are unchanged.
- **BR-37** Visual asset planning prefers compatible approved reuse, reframe and edit before new generation and preserves derivation lineage.

## Provider durability

- **BR-46** Persist ProviderOperation in `RESERVED` before external provider submission.
- **BR-47** Ambiguous outcome or timeout becomes `UNKNOWN`; do not blind-resubmit before reconciliation.
- **BR-48** Provider operation IDs/fingerprints are namespaced/idempotent according to the provider contract.
- **BR-49** Persisted `RESERVED`/`SUBMITTED` operations are recovered by reconciliation after restart rather than duplicate submit.
- **BR-50** A completed normalized provider result persisted before a process crash may be replayed into materialization without another provider call.
- **BR-51** A worker that loses its StageAttempt lease must not finalize successful output for that lease.
- **BR-52** A local/self-hosted GPU inference endpoint is still an external execution boundary for durability purposes; ambiguous submissions reconcile by operation ID or stable request identity before retry.

## Admission, quota and cost

- **BR-65** Server-side entitlement/quota/cost admission occurs before expensive Chapter Analyze work.
- **BR-66** Current reservation state is PostgreSQL-backed and atomic for the implemented Analyze foundation.
- **BR-67** Estimate is not invoice; actual usage/billing reconciliation is separate.
- **BR-68** Complete billing must release/refund unused reservation and preserve append-only accounting/audit evidence.
- **BR-69** Client feature flags/credit displays never grant server authority.
- **BR-70** Post-analysis media cost is calculated from planned billable workload plus versioned pricing/benchmark snapshots, not a hardcoded cost per scene.
- **BR-71** `expectedCost`, `reservationCeiling` and reconciled `actualCost` are distinct values.
- **BR-72** Self-hosted I2V cost is estimated from measured GPU compute for a versioned model/hardware/resolution/inference profile; benchmark data must not be presented as universal model pricing.
- **BR-73** Workers may not upgrade deterministic motion to GPU-heavy I2V outside the authorized `OperationPlan` and reservation.

## Concurrency

- **BR-75** Mutable state uses optimistic concurrency where exposed; stale expected version must fail rather than silently overwrite.
- **BR-76** Worker concurrency is bounded/configured, not unbounded task creation.
- **BR-77** StageAttempt lease/heartbeat state is durable; process memory is not authority.
- **BR-78** Provider/network calls do not hold long business database transactions open.

## Trust, safety and privacy

- **BR-98** Safety/abuse checks run before paid work where possible.
- **BR-99** Story/chapter/character/prompt/provider output are untrusted data and cannot redefine ownership, billing, storage, tool or policy authority.
- **BR-100** Story Analyze/Generate does not require a blanket per-story copyright/rights-attestation checkbox.
- **BR-101** Copyright report/review/takedown and real-person consent are separate policy concerns.
- **BR-102** Provider safety signals are defense-in-depth; application policy is canonical.
- **BR-103** Sensitive identity/reference data must remain tenant-scoped/private and obey retention/deletion policy.

## Media target rules

- **BR-110** Binary media is not stored in PostgreSQL.
- **BR-111** Image/TTS/render/provider work must reuse the durable StageAttempt/ProviderOperation principles rather than direct SDK calls from UI/domain code.
- **BR-112** FinalArtifact can become READY only after immutable object/metadata/checksum/MIME/dimension validation.
- **BR-113** Output ratio/quality are explicit settings/capabilities; silent stretch is prohibited.
- **BR-114** Visual count/duration budgets are planning policy, not fixed domain constants such as "one sentence = one image".
- **BR-115** `IMAGE_MOTION` authorizes deterministic image motion only; `HYBRID_LOCAL_I2V` may authorize selected-beat I2V according to motion value, capability, entitlement and cost policy.
- **BR-116** I2V generation resolution and final export resolution are independent planning choices; lower-resolution I2V may be upscaled during bounded render when quality policy allows.
- **BR-117** Generated I2V duration may be shorter than its narration span; deterministic composition may extend the approved motion asset without another I2V generation.

## Status interpretation

These are maintained product/domain rules. A rule may describe a `TARGET` capability even when the current implementation is incomplete. Use `../TRACEABILITY.md` to determine factual implementation status; do not infer implementation solely from a BR identifier.
