# NarrativeX security best-practices report

Date: 2026-08-21  
Scope: backend, frontend, AI worker, migrations, authentication/upload/job flows, and repository credential controls.

## Critical impact

The current working tree contains non-empty E2E credential values in a tracked example file; if they are real, they must be considered compromised and rotated without printing or reusing them.

## Findings

| ID | Severity | Area | Location | Summary |
|---|---|---|---|---|
| SEC-001 | Critical | Secrets | `.env.e2e.example:3-4`, `scripts/check-secrets.py:45` | Tracked credential values bypass the repository secret check. |
| SEC-002 | High | Authentication/data | `V2__seed_demo_data.sql`, `application.yml:33-35` | An enabled fixed demo identity is applied by the normal Flyway path. |
| SEC-003 | High | Upload integrity | `R2ObjectStorageAdapter.java:54-96`, `MediaUploadUseCase.java:152-156` | Client-controlled metadata is accepted as checksum verification. |
| SEC-004 | High | Resource abuse | `CreateUploadIntentRequest.java:7-12`, `MediaUploadUseCase.java:84-99` | Upload size/type are unbounded and rejected/unfinalized objects lack cleanup. |
| SEC-005 | High | Tenant isolation | `CreateMediaJobUseCase.java:57-67`, `GenerationJobMapper.xml:112-120` | Idempotency keys are global and replay is not ownership-safe. |
| SEC-006 | High | AI safety/cost | `MyBatisChapterAnalysisSafetyGate.java:18-34` | Missing moderation decisions fail open. |
| SEC-007 | High | Provider billing | `image_generation_runner.py:30-60` | External image submission has no durable reservation/`UNKNOWN` reconciliation fence. |
| SEC-008 | Medium | Availability | `MediaUploadUseCase.java:70-91`, `R2ObjectStorageAdapter.java:132-141` | Remote I/O without explicit deadlines runs under a database row lock. |
| SEC-009 | Medium | Abuse control | `AuthRateLimiter.java:100-118` | Redis-outage fallback performs a full-map cleanup per request. |
| SEC-010 | Medium / verify | Browser security | `app/frontend-web/next.config.mjs:9-37` | Application-level security headers are not visible; edge configuration may provide them. |

## Remediation details

### SEC-001 — Tracked credentials and scanner blind spot

Rule: secrets must not be stored in source-controlled files; example files must contain placeholders only.

Evidence: both E2E credential variables are non-empty in `.env.e2e.example`. The value contents were deliberately not copied into this report. The file is tracked by design, while the secret scanner skips it entirely.

Fix:

1. Revoke/rotate the account credentials.
2. Restore empty or unmistakably non-secret placeholders.
3. Search Git history, CI artifacts, caches, and shared patches without echoing values into logs.
4. Change `check-secrets.py` to inspect tracked example files and reject non-placeholder assignments.
5. Add a regression fixture/test proving `.env.e2e.example` cannot contain a usable value.

Mitigation if immediate rotation is impossible: disable the account and all active sessions, restrict it at the identity provider, and remove its environment access until rotation completes.

### SEC-002 — Production-reachable demo identity

Rule: production migrations must not create fixed enabled test identities or sample authorization state.

Evidence: the default Flyway location contains `V2__seed_demo_data.sql`; no profile-specific migration location prevents it from running outside local development.

Fix: isolate seeds behind a local profile or explicit seed command, remove/disable seeded identities in affected databases, and keep repeatable production migrations limited to real schema/data corrections.

### SEC-003 — Unverified upload content

Rule: integrity decisions must be based on independently computed data, not a client assertion.

Evidence: the presigned request uses an unsigned payload and signs a custom metadata digest. Finalization falls back to that metadata and records the asset as verified.

Fix: require a provider-computed checksum bound into the signed request or compute the digest server-side. Enforce media magic/type validation before approval. Never use custom metadata alone as proof of content integrity.

### SEC-004 — Unbounded upload abuse

Rule: externally supplied files require server-side limits, validation, quotas, and lifecycle cleanup.

Evidence: the request validates only that size is positive; the signed upload does not enforce the declared size/type; rejected and abandoned objects have no visible deletion path.

Fix: define per-asset-type maximums, MIME and magic allowlists, account quotas and rate limits, signed constraints, short intent expiry, and an idempotent object cleanup/reconciliation job.

### SEC-005 — Cross-tenant idempotency scope

Rule: all resource lookup and replay keys must be tenant/owner scoped before data is returned.

Evidence: locking, lookup, and database uniqueness use the raw idempotency key globally. The existing result path can return a job after the owned projection is absent.

Fix: scope unique indexes, locks, and queries by owner and operation type; perform authorization before returning replay data; test two tenants using the same key.

### SEC-006 — Moderation absence fails open

Rule: untrusted story/prompts must not reach paid providers without a current durable allow decision.

Evidence: only explicit `BLOCK` and `REVIEW` are denied; a missing decision is permitted, and no normal production writer for moderation decisions was found.

Fix: deny missing/stale/pending/review states, attach decisions to the exact source revision/hash, and implement the moderation stage before permitting analysis submission.

### SEC-007 — Ambiguous provider outcomes can be resubmitted

Rule: durable reservation/outbox state must precede external submission; ambiguous outcomes become `UNKNOWN` and reconcile before retry.

Evidence: the image runner calls the provider before any visible durable provider-request reservation and persists only success after upload.

Fix: introduce an immutable provider operation record with compare-and-set transitions (`RESERVED` → `SUBMITTED`/`UNKNOWN` → terminal), provider idempotency where available, reconciliation, and manual-attention handling.

### SEC-008 — Lock-held network I/O

Rule: untrusted external latency must be bounded and must not hold scarce transactional resources.

Evidence: upload finalization locks a database row and calls object storage with no explicit request deadline.

Fix: use short reserve/complete transactions around a bounded network operation; configure connect/read/request deadlines and an explicit recovery state.

### SEC-009 — Rate-limit fallback amplification

Rule: security controls must degrade with bounded work during dependency outages.

Evidence: each fallback request removes expired entries by scanning the full map, which can reach 10,000 entries during a Redis outage/attack.

Fix: use a size- and time-bounded expiry cache (for example Caffeine), sampled/periodic eviction, and metrics/alerts for fallback activation. Keep the security posture explicitly fail-open or fail-closed per endpoint risk.

### SEC-010 — Deployment security headers not proven

Rule: browser responses should define a tested CSP, clickjacking protection (`frame-ancestors`), `X-Content-Type-Options`, referrer policy, and a restrictive permissions policy.

Evidence: no application-level configuration for these headers was found in `next.config.mjs`. This may be a false positive if the deployment edge sets and tests them.

Fix: inspect production response headers. Prefer an edge/application CSP with nonces or hashes rather than `unsafe-inline`; keep authentication cookies server-managed, `HttpOnly`, `Secure`, and appropriately `SameSite`.

## Positive controls observed

- Browser authentication is based on server-managed Spring Security sessions and CSRF rather than client-stored access tokens.
- No `dangerouslySetInnerHTML`, `eval`, raw HTML rendering, or client-controlled identity header pattern was found in the reviewed frontend/runtime code.
- PostgreSQL is used for durable job/business state, consistent with the repository's authority boundary.

## Verification limitations

- This was a source review, not a penetration test.
- Backend tests could not run because no Java runtime / `JAVA_HOME` was available. The bundled Python runtime was available for syntax compilation, but `pytest`, Ruff, and MyPy were not installed.
- Dependency vulnerability lookup could not reach the npm registry, and external transmission of dependency metadata was not authorized.
- Production proxy/CDN, cloud IAM, R2 bucket policy, database grants, and live response headers were outside the local repository evidence.

## Remediation status

Applied in the current worktree: tracked E2E values were replaced with placeholders and the scanner now validates that file; demo seed data is local-profile-only; uploads use provider-computed checksum headers with server-side type/size policy, timeout, and cleanup; idempotency lookups are owner-scoped; missing moderation fails closed; media/render endpoints are disabled until a durable consumer is enabled; and the worker shares a process-wide provider concurrency budget. The image runner itself remains gated because its repository adapter still needs to be wired to the durable provider-operation reservation/reconciliation interface.
