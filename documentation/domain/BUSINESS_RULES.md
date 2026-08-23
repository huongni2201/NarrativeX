# NarrativeX V1.11 — Business Rules

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

## Core lifecycle

- **BR-01** Project creation is metadata-only and never implicitly enqueues AI/media work.
- **BR-02** Chapter source is persisted before Analyze; unsaved browser text is not execution authority.
- **BR-03** Expensive workflows pin durable source identity (`chapterId`, `rowVersion`, `sourceHash`).
- **BR-04** PostgreSQL is authoritative for durable state; Redis generation hints are non-authoritative.
- **BR-05** Long-running AI/media work is asynchronous and recoverable from durable state.

## Narration

- **BR-34** Source-preserving TTS narrates the exact persisted Chapter text; it does not rewrite source.
- **BR-35** Narration alignment is visual-timeline duration authority.
- **BR-38** Narration supports `TTS` and `USER_PROVIDED_AUDIO` strategies.
- **BR-39** User-provided audio may be one file for many Chapters or multiple ordered files for the same Chapter scope; file boundaries are not Chapter boundaries.
- **BR-40** A `USER_PROVIDED_AUDIO` plan omits TTS generation and must not reserve/charge TTS workload for the covered scope.
- **BR-41** User-provided audio that fails alignment acceptance must stop for review/fix rather than silently fall back to replacement TTS.
- **BR-42** Narration document/audio fingerprints are immutable inputs to planning and rendering.

## Provider durability

- **BR-46** Persist ProviderOperation intent before crossing an external/provider boundary.
- **BR-47** Ambiguous outcomes become `UNKNOWN`; reconcile before resubmission.
- **BR-48** Provider mutations use expected-state/version predicates; terminal states do not reopen.
- **BR-49** `COMPLETED + same result_fingerprint` is idempotent; a different fingerprint is an invariant conflict.
- **BR-50** Losing local scratch is not a reason to repeat paid work if a valid durable result already exists.

## Media planning and production modes

- **BR-70** Media workload is priced from versioned pricing/benchmark data, not hardcoded dollars per scene.
- **BR-71** `expectedCost`, `reservationCeiling` and `actualCost` are distinct.
- **BR-73** Workers may not upgrade motion outside the authorized MediaPlan.
- **BR-115** `IMAGE_MOTION` permits deterministic motion only; `HYBRID_LOCAL_I2V` may authorize selected I2V.
- **BR-118** The backend is MediaPlan/motion-policy authority; the worker executes the pinned plan revision.
- **BR-119** For the first vertical slice, image execution may use `GENERATE_NEW` only; this does not revoke the long-term reuse-first architecture.

## Durable media

- **BR-110** Binary media is not stored in PostgreSQL.
- **BR-111** Cloudflare R2 is authoritative for source/generated/reusable pipeline media; Google Drive is authoritative for final rendered MP4 bytes.
- **BR-112** A pipeline-media stage is not complete until bytes validate, immutable R2 persistence succeeds and authoritative metadata commits. A final-video stage additionally requires validated Drive durability and verification.
- **BR-113** Worker-local media paths are scratch/cache only.
- **BR-114** FinalArtifact becomes ready only after checksum/MIME/dimensions/duration/manifest validation.

## Persistence

- **BR-120** New persistence-heavy backend work converges on MyBatis + explicit SQL + PostgreSQL unless an ADR records an exception.
- **BR-121** SQL concurrency/state transitions use CAS/allowed-previous predicates and affected-row validation.
- **BR-122** JPA is absent from production persistence; direct JDBC helpers are limited to test/integration support and must not become the production persistence boundary.

## History and continuity

- **BR-20** Character identity is reusable; appearance/outfit changes do not create a new Character identity.
- **BR-22** Continuity uses stable durable IDs/AI keys rather than display names.
- **BR-32** Re-analysis does not destructively overwrite approved history without explicit revision/reset behavior.
- **BR-33** Regeneration creates new attempts/assets rather than overwriting immutable approved outputs.
