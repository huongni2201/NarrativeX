# ADR-0018: Backend control plane and domain-agnostic GPU execution plane

## Status

Accepted

## Context

The Python `ai-worker` currently polls NarrativeX PostgreSQL tables and combines domain
orchestration, job claiming, lifecycle transitions, project materialization, provider integration,
TTS, image generation, alignment and media validation. This duplicates business ownership outside
the Spring modular monolith and makes local-to-remote GPU routing a business-code change.

The backend already persists `GenerationJob`, `StageAttempt`, `NarrationOperation`,
`ProviderOperation`, `OperationPlan`, quota reservations and transactional outbox records. In
particular, `ProviderOperation.UNKNOWN` already protects ambiguous external submissions from blind
resubmission.

## Decision drivers

- Keep durable business truth and orchestration in one modular-monolith control plane.
- Use the same execution software and contract for local RTX 4060 and rented GPUs.
- Prevent compute infrastructure from coupling to NarrativeX domain and database schemas.
- Preserve durable reservation-before-submit, idempotency, retry and reconciliation semantics.
- Make VoiceStudio, WhisperX, ComfyUI and later engines replaceable executor adapters.
- Exchange bytes without leaking machine-specific filesystem paths.

## Decision

Spring Boot is the NarrativeX control plane. It exclusively owns domain interpretation,
admission, job/operation lifecycle, compute routing, model/target registry, retry/recovery,
idempotency, quota/entitlement, outbox, artifact coordination and PostgreSQL persistence.

Create `app/gpu-worker` as a new domain-agnostic HTTP execution plane. It implements
`documentation/COMPUTE_PROTOCOL.md`, does not connect to NarrativeX PostgreSQL, and does not receive
NarrativeX domain identifiers. The backend turns domain state into typed `ComputeTask` requests and
turns verified `ComputeResult` observations into domain transitions.

Local and remote workers use one protocol and implementation. Target registry configuration selects
the endpoint, credentials, capabilities and scheduling weight. Engine integrations live behind
worker executor ports. Model changes occur through validated executor/model registry entries rather
than narration/image domain branches.

Artifacts cross the boundary as integrity-checked, time-bounded `ArtifactRef` capabilities. Absolute
paths, Windows paths, database credentials and project-relative storage knowledge do not cross the
protocol.

This is a replacement migration, not a rename of `ai-worker`. Only domain-neutral executor and
validation code with tests is migrated. Direct SQL repositories, claims, materialization,
orchestration, provider-operation lifecycle and project workspace resolution are not copied. The
legacy worker and unused chapter-analysis, browser/Vertex image and provider paths are hard-deleted
after their dependencies are removed and each vertical slice passes cut-over gates.

Narration is the first vertical slice because backend admission and durable lifecycle already exist.
Image generation, media validation and other compute tasks follow after the contract is proven.

## Consequences

### Positive

- Business lifecycle has one authoritative owner and one transactional persistence boundary.
- Local and remote compute become deployment choices rather than domain choices.
- Executors can change without importing provider SDKs into backend domain modules.
- Worker scaling and failure recovery no longer depend on sharing NarrativeX database access.
- The protocol becomes independently contract-testable and security-reviewable.

### Negative

- Backend needs dispatch, callback/reconciliation and artifact-gateway infrastructure.
- The worker needs a small durable execution journal to replay attempts safely across restart.
- Cut-over temporarily operates old and new deployments, increasing migration complexity.
- Presigned/capability artifact transport requires expiry refresh and checksum handling.

### Risks and mitigations

- **Duplicate compute:** persist reservation before submit; fingerprint every attempt; replay by
  idempotency key; map transport ambiguity to `UNKNOWN` and reconcile before retry.
- **Domain leakage through flexible payloads:** use closed task-specific schemas and forbid arbitrary
  metadata/domain identifiers.
- **Artifact credential leakage:** redact capabilities, keep expiry short, scope each capability to
  one object and operation, verify digest before publication.
- **Local/remote drift:** run the same contract suite and image for both target classes.
- **Long dual runtime:** cut over one vertical slice at a time with explicit deletion gates; do not
  introduce indefinite dual-write.

## Supersedes

This ADR supersedes ADR-0014 only where it assigns workers direct PostgreSQL queue polling. PostgreSQL
remains the only required durable application-state service; no Redis or broker is introduced.

It supersedes ADR-0027 where VoiceStudio, WhisperX and narration execution are placed inside the
domain-aware `ai-worker`; their functional audio decisions remain valid behind execution adapters.

It supersedes ADR-0021 and any current-state documentation that retains browser/Vertex image
generation after the corresponding dependency-free cut-over gate is met.

## References

- `documentation/COMPUTE_PROTOCOL.md`
- `documentation/decisions/ADR-0014-postgresql-only-mvp-runtime-state.md`
- `documentation/decisions/ADR-0023-vieneu-remote-gpu-media-runtime.md`
