# Compute execution-plane migration inventory

## Snapshot

- Audited on 2026-09-14 from `main` after it had advanced 40 commits beyond
  `origin/refactor/compute-execution-plane`.
- Local implementation branch was recreated from current `main` as
  `refactor/compute-execution-plane`; the remote branch is a strict ancestor, so a later push can be
  fast-forwarded.
- No committed `app/gpu-worker` exists on current `main` or the remote migration branch. No
  unpublished scaffold is visible in this repository; any scaffold held in another worktree or
  machine must be supplied separately and reviewed rather than assumed.
- The stale remote-only commit mixes Qwen/VoiceStudio work with provider and GPU-ownership changes.
  It is classified as reference-only: executor code may be reviewed selectively, while Vertex and
  domain-aware worker changes are discarded.

## Current ownership violations

`app/ai-worker` is a domain-aware runtime with roughly one hundred Python source files. It imports
`asyncpg`, accepts `DATABASE_URL`, polls/claims durable work, transitions lifecycle rows, performs
provider reconciliation, and materializes NarrativeX aggregates. It is not a suitable starting
point for the new worker package.

### Direct PostgreSQL areas

| Area | Representative source | Current responsibility | Destination |
|---|---|---|---|
| General generation | `repository/claims.py`, `repository/completion.py`, `repository/implementation.py`, `repository/operations.py` | Claim `stage_attempts`, update `generation_jobs`, reserve/reconcile `provider_operations` | Backend compute orchestration and persistence adapters |
| Image generation | `image_generation_repository/claims.py`, `submission.py`, `reconciliation.py`, `aggregation.py`, `materialization.py` | Claim, submit, reconcile, aggregate and materialize image work | Lifecycle/materialization to backend; provider calls to executor |
| Narration | `narration/repository/claims.py`, `completion.py`, `implementation.py`, `operations.py` | Claim narration, load domain inputs, update operations/assets | Backend narration use cases and compute mapping |
| Storyboard/continuity | `materialization/storyboard.py`, `continuity.py`, `identity.py` | Write scenes, visual beats, continuity and identity mappings | Backend domain/application modules |
| Media validation | `media_validation_repository.py`, `media_repository.py` | Claim and persist validation/media outcomes | Backend orchestration; pure byte validation to executor |
| Health/GPU ownership | `health.py`, `gpu_ownership.py` | Database health and distributed GPU lease ownership | Target health/capacity in backend; local concurrency in worker |

Observed business tables include `generation_jobs`, `stage_attempts`, `provider_operations`,
`narration_operations`, `projects`, `chapters`, `scenes`, `visual_beats`, project character/location
and media/asset tables. The exact SQL inventory must remain a deletion checklist as files move; none
of these names may appear in production `app/gpu-worker` source or protocol schemas.

## Responsibility disposition

### Migrate by rewriting behind executor interfaces

- `providers/tts/voicestudio.py`: VoiceStudio HTTP transport, response parsing and safe retry
  classification only.
- `narration/word_alignment.py` and the WhisperX implementation reached through it: known-script
  alignment only.
- `providers/realvisxl.py` and ComfyUI transport: submission/status/output parsing without
  NarrativeX operation or materialization knowledge.
- `narration/audio.py`, `media_validation.py` and relevant `media.py` functions: pure byte/media
  validation and normalization only.
- `runtime/retry_policy.py`: only executor-local transport backoff; backend retains attempt policy.

Migration means extracting behavior into a new package with new protocol-facing tests. It does not
mean copying modules wholesale or retaining their imports.

### Move responsibility to backend; do not migrate code

- All PostgreSQL repositories, SQL claims, completion fencing and provider reconciliation.
- `GenerationJob`, `StageAttempt`, `ProviderOperation`, `NarrationOperation` transitions.
- Storyboard, scene, visual-beat, identity, continuity and asset materialization.
- Chapter segmentation/orchestration when it encodes NarrativeX product policy.
- Project workspace resolution, manifests, local storage roots and absolute path handling.
- Quota, entitlement, abuse, capacity reservation and retry/recovery decisions.

### Hard-delete after dependency-free cut-over

- Chapter analysis/API AI paths that have been replaced by backend-owned use cases.
- Vertex and browser/web image generation paths, settings, tests and documentation.
- Disabled/fake production provider selection; deterministic fakes remain only in isolated tests.
- Old worker entrypoints, PostgreSQL health/ownership, Docker services and CI jobs.
- `asyncpg` and `DATABASE_URL` from the worker runtime.

## Deployment and documentation references

- `docker-compose.yml` builds both `ai-worker` and `narration-worker` from `app/ai-worker`, injects
  `DATABASE_URL`, depends on PostgreSQL and mounts project media paths.
- CI and `scripts/verify-local.ps1` run the legacy worker test/type/lint suite; no GPU worker job
  exists.
- Current architecture/data-flow/narration/image/service-boundary documents describe direct
  PostgreSQL polling and must be updated per vertical slice.
- ADR-0020's PostgreSQL-as-authoritative rule remains; only direct worker polling is superseded.
- ADR-0027's VoiceStudio/WAV/WhisperX functional decisions remain, but execution moves behind the
  compute interface.

## Test disposition

### Recreate or migrate as executor tests

- VoiceStudio adapter behavior, redirects, authentication redaction and response validation.
- WhisperX word-alignment schema and known-script behavior.
- ComfyUI/RealVisXL transport, progress and output validation.
- WAV/audio/media validation, timeout and retry classification.

### Replace with backend lifecycle and contract tests

- PostgreSQL claim concurrency, completion fencing and provider-operation reconciliation.
- Image/narration repository boundary and crash recovery tests.
- Domain materialization invariants and project-scoped storage resolution.
- Worker service tests that assert direct `GenerationJob` or `StageAttempt` behavior.

## Automated forbidden-dependency gate

Add a repository check that scans production `app/gpu-worker` source and fails on:

- imports or dependencies named `asyncpg`, Spring/MyBatis/PostgreSQL drivers, or `DATABASE_URL`;
- NarrativeX domain/table vocabulary including project/chapter/scene/visual-beat/job/operation IDs;
- URI fields with `file` scheme, drive-letter/UNC values, or request fields named `path`;
- imports from `narrativex_worker` or backend packages;
- provider credentials, signed artifact capabilities or untrusted inputs written to logs.

The scanner complements strict closed JSON schemas and architecture tests; it is not a substitute
for protocol and security review.

## Cut-over deletion gate

Before deleting any legacy area, prove that routing is disabled, no exclusive consumer remains,
success/failure/replay/restart/ambiguous-submit tests pass, artifact publication is verified, and
rollback can change routing without replaying an ambiguous operation. Git is the recovery mechanism
for deleted source; no destructive filesystem cleanup is used during migration.
