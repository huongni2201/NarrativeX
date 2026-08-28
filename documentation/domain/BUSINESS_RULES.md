# NarrativeX V1.11 — Business Rules

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Runtime decision:** ADR-0020 for PostgreSQL-only MVP runtime state.

These rules describe maintained product/domain constraints. A rule that names a target capability does not imply that every implementation path is complete; consult `../TRACEABILITY.md` for current implementation status.

## Core lifecycle

- **BR-01** Project creation is metadata-only and never implicitly enqueues AI/media work.
- **BR-02** Chapter source is persisted before Analyze; unsaved renderer text is not execution authority.
- **BR-03** Expensive workflows pin durable source identity (`chapterId`, `rowVersion`, `sourceHash`).
- **BR-04** PostgreSQL is authoritative for durable state and worker queue discovery; Redis/broker notifications are not required by the MVP runtime.
- **BR-05** Long-running AI/media work is asynchronous and recoverable from durable state.

## Storyboard and continuity

- **BR-20** Character identity is reusable; appearance/outfit changes do not create a new Character identity.
- **BR-21** An explicitly pinned `CharacterVersion` is not silently replaced by later AI analysis.
- **BR-22** Continuity uses stable durable IDs/AI keys rather than display names.
- **BR-23** VisualBeat Character participation contains only Characters visible in that beat and each beat Character must already participate in the parent Scene.
- **BR-24** Beat Character roles are `PRIMARY`, `SECONDARY`, or `BACKGROUND`; role is visual participation metadata, not a new Character identity.
- **BR-25** `CharacterAppearance` represents timeline/project visual state and is separate from canonical Character identity/version.
- **BR-32** Re-analysis does not destructively overwrite approved history without explicit revision/reset behavior.
- **BR-33** Regeneration creates new attempts/assets rather than overwriting immutable approved outputs.

## Narration and Visual Beat timing

- **BR-34** Source-preserving TTS narrates the exact persisted Chapter text; it does not rewrite source.
- **BR-35** Compatible real narration alignment is the visual timing authority; generic fallback geometry is not exact alignment.
- **BR-36** AI analysis selects semantic source content and must not calculate numeric character offsets or audio timestamps.
- **BR-37** Exact VisualBeat source offsets, when materialized, are UTF-16 half-open ranges over the pinned Chapter source snapshot.
- **BR-38** Narration supports `TTS` and `USER_PROVIDED_AUDIO` strategies.
- **BR-39** User-provided audio may be one file for many Chapters or multiple ordered files for the same Chapter scope; file boundaries are not Chapter boundaries.
- **BR-40** A `USER_PROVIDED_AUDIO` plan omits TTS generation and must not reserve/charge TTS workload for the covered scope.
- **BR-41** User-provided audio that fails alignment acceptance must stop for review/fix rather than silently fall back to replacement TTS.
- **BR-42** Narration document/audio fingerprints are immutable inputs to planning and rendering.
- **BR-43** VisualBeat audio timing may be written from narration alignment only when source identity/hash is compatible with the current storyboard source snapshot.
- **BR-44** Missing exact VisualBeat audio timing remains distinguishable from `ALIGNED` timing; UI/backend must not label provisional/fallback geometry as exact.
- **BR-45** A current immutable MediaPlan timing snapshot supersedes storyboard draft/fallback timing for production/render planning.

Implementation note: at the current audited checkpoint, narration alignment persistence exists but deterministic VisualBeat source offsets and source-to-audio reconciliation remain TARGET/PARTIAL.

## Provider durability

- **BR-46** Persist ProviderOperation intent before crossing an external/provider boundary.
- **BR-47** Ambiguous outcomes become `UNKNOWN`; reconcile before resubmission.
- **BR-48** Provider mutations use expected-state/version predicates; terminal states do not reopen.
- **BR-49** `COMPLETED + same result_fingerprint` is idempotent; a different fingerprint is an invariant conflict.
- **BR-50** Losing local scratch is not a reason to repeat paid work if a valid durable result already exists.

## Media planning and production modes

- **BR-70** Media workload is priced from versioned pricing/benchmark data, not hardcoded dollars per Scene.
- **BR-71** `expectedCost`, `reservationCeiling` and `actualCost` are distinct.
- **BR-73** Workers may not upgrade motion outside the authorized MediaPlan.
- **BR-115** `IMAGE_MOTION` permits deterministic motion only; `HYBRID_LOCAL_I2V` may authorize selected I2V when that optional path is implemented/enabled.
- **BR-118** The backend is MediaPlan/motion-policy authority; workers/Desktop executors execute pinned authorized policy.
- **BR-119** Current image generation may use `GENERATE_NEW`; this does not revoke the longer-term reuse/reframe/edit architecture.

## Durable media

- **BR-110** Binary media is not stored in PostgreSQL.
- **BR-111** Cloudflare R2 may provide generated-media transport/durability before Desktop materialization; final rendered MP4 bytes are local project artifacts owned by Electron ProjectStorage.
- **BR-112** A generated provider-media stage is not complete until required bytes validate and authoritative metadata/durability commits. Final local rendering additionally requires local input integrity and final artifact validation.
- **BR-113** Worker-local media paths are scratch/cache only; Desktop project-relative paths belong to Electron main/ProjectStorage.
- **BR-114** FinalArtifact becomes ready only after local render output validation and backend metadata registration succeed under the current lease.

## Persistence

- **BR-120** New persistence-heavy backend work converges on MyBatis + explicit SQL + PostgreSQL unless an ADR records an exception.
- **BR-121** SQL concurrency/state transitions use CAS/allowed-previous predicates and affected-row validation.
- **BR-122** JPA is absent from production persistence; direct JDBC helpers must not become a parallel domain persistence boundary.
- **BR-123** Flyway V1-V8 are the clean pre-release baseline; after the first production deployment, applied migrations become immutable and new schema evolution is append-only.

## Documentation lifecycle

- **BR-130** Current code/migrations/tests decide factual AS-IS behavior; plans and ADR history alone do not prove implementation.
- **BR-131** Accepted ADR bodies remain historical decision evidence; supersession is recorded in `../decisions/README.md` rather than silently rewriting old rationale.
- **BR-132** Implementation plans are non-authoritative and require ACTIVE/COMPLETED/SUPERSEDED lifecycle status in `../../docs/superpowers/plans/README.md`.
