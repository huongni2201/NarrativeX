# NarrativeX codebase audit — 2026-08-21

## Executive summary

This review covered the Spring Boot backend, Next.js frontend, Python AI worker, database migrations, repository rules, and implementation-facing architecture documents at commit `0acb2c65` plus the current working tree.

The modular-monolith direction and durable PostgreSQL/outbox foundations are sound, but the reviewed snapshot is not production-ready for the media-generation path. One critical credential-handling issue and several high-risk correctness/security gaps need attention before exposing those flows publicly.

Priority counts:

- P0 / Critical: 1
- P1 / High: 12
- P2 / Medium: 6

## Immediate actions

1. Revoke or rotate the credentials currently present in `.env.e2e.example`, restore placeholders, and inspect Git history and CI artifacts for exposure. Do not print the values while investigating.
2. Prevent `V2__seed_demo_data.sql` from running in production and remove or disable any seeded authentication identity already applied.
3. Disable or feature-gate media generation/render endpoints until there are durable consumers and the provider reservation/`UNKNOWN` reconciliation fence is implemented.
4. Stop treating client-supplied object metadata as checksum proof; enforce provider-computed checksums and strict server-side upload limits.

## Findings

### NX-001 — P0 — Credentials are present in a tracked example file

Evidence:

- `.env.e2e.example:3-4` currently contains non-empty values for both E2E credential variables.
- `.gitignore:8` explicitly keeps this example file tracked.
- `.agents/rules/test-credentials.md:9-12` requires real credentials to live only in ignored `.env.e2e.local` or process environment.
- `scripts/check-secrets.py:45` skips `.env.e2e.example`, so the repository's secret check cannot catch this failure.

Impact: if the values are real, repository readers, CI logs, caches, or future commits can expose an account. Treat them as compromised until verified otherwise.

Recommendation: rotate/revoke first, replace values with empty placeholders, inspect history and artifacts, then make the secret checker validate example files for placeholders rather than excluding them.

### NX-002 — P1 — Demo data migration is enabled for every runtime profile

Evidence:

- `app/backend-service/src/main/resources/application.yml:33-35` always points Flyway at `classpath:db/migration`.
- `app/backend-service/src/main/resources/db/migration/V2__seed_demo_data.sql:1-3` describes itself as local/demo data, but the same migration inserts an enabled authentication identity and extensive demo business state.
- `documentation/codebase/DATABASE_BASELINE.md:16` says the seed is development-only, which does not match runtime behavior.

Impact: a fresh production database can receive a fixed demo identity, provider/job state, quotas, and misleading business records. A known or recovered password for the seeded account could become an authentication path.

Recommendation: move demo seeds to a local-only Flyway location or an explicit seed command. Add a corrective production procedure/migration for environments where V2 already ran, and never ship fixed enabled identities in normal migrations.

### NX-003 — P1 — Upload checksum verification trusts attacker-controlled metadata

Evidence:

- `R2ObjectStorageAdapter.java:54-81` signs `x-amz-meta-sha256` while using `UNSIGNED-PAYLOAD`.
- `R2ObjectStorageAdapter.java:93-96` falls back to that same metadata when a provider checksum is absent.
- `MediaUploadUseCase.java:152-156` compares the declared checksum to this value and then marks the asset ready.

Impact: a client can upload bytes different from the claimed digest, keep the same declared size, and have the object treated as verified. Downstream parsers and providers then consume unverified content.

Recommendation: bind a provider-computed checksum such as `x-amz-checksum-sha256` into the signed upload contract, or stream and hash server-side. Validate magic bytes/media structure and set `checksum_verified_at` only after independent verification.

### NX-004 — P1 — Upload size/type are not bounded and rejected objects are orphaned

Evidence:

- `CreateUploadIntentRequest.java:7-12` requires only a positive size; there is no maximum or per-asset-type policy.
- `R2ObjectStorageAdapter.java:54-81` does not bind the declared content length or media type into the signed request.
- `MediaUploadUseCase.java:84-99` rejects mismatches in database state but does not delete the uploaded object.
- `AssetUploadModal.tsx:19-21` calls `file.arrayBuffer()`, loading the whole file into browser memory.

Impact: storage-cost abuse, oversized-parser inputs, orphaned objects, and browser memory exhaustion are possible.

Recommendation: add server-authoritative per-type byte limits, MIME/magic allowlists, account quotas/rate limits, signed content constraints, an expiry cleanup job, and a client-side cap before hashing. Prefer incremental hashing for permitted large files.

### NX-005 — P1 — A blocking storage call occurs while holding a database lock

Evidence:

- `MediaUploadUseCase.java:70-91` is transactional and performs a remote object `HEAD` call.
- `MediaUploadSessionMapper.xml:32-39` locks the upload session with `FOR UPDATE`.
- `R2ObjectStorageAdapter.java:43-45,132-141` uses an HTTP client/request without explicit connect or request timeouts.

Impact: a slow object store can hold a PostgreSQL connection and row lock indefinitely, serializing finalization and exhausting request/connection pools.

Recommendation: use a short transaction to reserve finalization, execute the bounded remote call outside the transaction, then complete with a short compare-and-set transaction. Configure connect and request deadlines.

### NX-006 — P1 — Job idempotency is global rather than tenant-scoped

Evidence:

- `CreateMediaJobUseCase.java:57-67` locks and looks up by the raw idempotency key before ownership is established.
- `GenerationJobMapper.xml:112-120` and `V1__initial_schema.sql:608-610` define the lookup/uniqueness globally, without owner and operation type.
- An existing job can be returned even when the ownership projection for the caller is empty.

Impact: a colliding or guessed key can leak another tenant's job identifiers and can deny the legitimate caller use of that key.

Recommendation: define uniqueness and advisory locks over `(owner_id, operation_type, idempotency_key)`, and authorize every replay before returning it. Idempotency keys should not be treated as bearer secrets.

### NX-007 — P1 — Public media/render jobs have no durable consumer

Evidence:

- `MediaGenerationController.java:34-41` and `RenderController.java:24-34` accept media/render work.
- `app/ai-worker/src/narrativex_worker/__main__.py:22-35` starts only analysis and narration runners.
- Analysis and narration claim queries accept only `CHAPTER_ANALYZE` and `NARRATION_GENERATE` respectively.

Impact: `CHAPTER_GENERATE` and `CHAPTER_RENDER` jobs remain queued indefinitely while reservations and concurrency capacity can remain occupied.

Recommendation: gate these endpoints/capabilities until durable runners exist, or implement the consumers plus terminal-state, retry, reservation-release, recovery, and end-to-end tests.

### NX-008 — P1 — Image submission bypasses the required provider ambiguity fence

Evidence:

- `image_generation_runner.py:30-33` calls the provider directly.
- Completion is persisted only after provider output upload at `image_generation_runner.py:42-60`.
- `media_repository.py:22-33` exposes completion/materialization but no durable reservation, `UNKNOWN`, or reconciliation contract.

Impact: a crash or timeout after external acceptance can cause blind resubmission and duplicate paid work.

Recommendation: persist an immutable provider request snapshot and reservation before submission, transition ambiguous outcomes to `UNKNOWN` with compare-and-set semantics, and reconcile before retrying.

### NX-009 — P1 — Render requests do not pin the requested media plan revision

Evidence:

- `CreateChapterRenderRequest.java:8-13` accepts `mediaPlanId` and revision.
- `CreateChapterRenderUseCase.java:40-51,85-105` builds from a mutable workspace projection instead of enforcing those requested values.
- `GenerationJob.java:246-248` leaves the media-plan pointer unset.

Impact: a render can use stale or unintended assets/narration and cannot reliably reproduce the user's approved plan.

Recommendation: fail closed unless the owned, approved plan and exact revision exist; persist an immutable render manifest containing all selected asset, character, audio, provider, and entitlement versions.

### NX-010 — P1 — Media planning omits required immutable snapshots

Evidence:

- `MediaPlanningSourceService.java:60-73` leaves timing and narration identifiers null.
- `CreateMediaPlanUseCase.java:94-124` stores an empty character snapshot and null fingerprint.

Impact: a plan cannot prove which participating `CharacterVersion` or audio timeline it approved, undermining reproducibility and the repository's character/versioning invariants.

Recommendation: resolve participating characters only, pin approved immutable versions and audio/timing inputs, calculate a deterministic fingerprint, and reject planning when mandatory context is unavailable.

### NX-011 — P1 — Analysis moderation fails open when no decision exists

Evidence:

- `MyBatisChapterAnalysisSafetyGate.java:18-34` blocks explicit `BLOCK`/`REVIEW` decisions but permits a missing decision.
- `ChapterAnalysisSafetyMapper.xml:6-14` only reads the latest decision.
- No production write path for `moderation_decisions` was found outside schema/demo data.

Impact: newly supplied untrusted story content can reach a paid provider without a durable moderation pass.

Recommendation: make missing, stale, pending, or review decisions fail closed; add a durable moderation stage and tests covering absence, stale source revisions, review, block, and allow.

### NX-012 — P1 — Server-side plan entitlements are fetched but discarded

Evidence:

- `JdbcUserQuotaQueryAdapter.java:32-44` reads watermark, maximum video quality, and export constraints.
- `JdbcUserQuotaQueryAdapter.java:81-91` maps only a subset into `PlanFeatures.java:5-23`.
- Media/render creation therefore cannot authoritatively enforce or pin these properties.

Impact: quality, export, and watermark behavior can drift from the purchased plan or be left to downstream/client assumptions.

Recommendation: model the complete entitlement set, validate it before expensive operations, and pin the authoritative entitlement snapshot into the operation/render manifest.

### NX-013 — P1 — Worker concurrency can be twice the documented process limit

Evidence:

- `config.py:34-39` describes `max_concurrent_jobs` as a process-wide maximum.
- `__main__.py:30,35` starts analysis and narration runners concurrently.
- Each runner creates its own semaphore of size `max_concurrent_jobs` and its own database pool.

Impact: one process can run up to `2N` provider jobs and provision roughly `3N+3` database connections, surprising operators and causing provider/DB overload.

Recommendation: share one process-wide concurrency budget and preferably one bounded pool, or rename/document independent limits and validate the combined budget against provider and database capacity.

### NX-014 — P2 — `ffprobe` can run forever on hostile or corrupt media

Evidence:

- `narration/audio.py:95-109` runs `ffprobe` without a timeout.
- `rendering/validation.py:10-23` starts it asynchronously without a timeout/kill path.
- `rendering/ffmpeg.py:11-23` already contains the bounded pattern that should be reused.

Impact: a single bad input can pin a worker slot or thread indefinitely.

Recommendation: centralize process execution with deadlines, kill-and-wait cleanup, bounded captured output, and platform-appropriate resource limits.

### NX-015 — P2 — Character pages mistake the first 100 results for the whole collection

Evidence:

- `CharacterDetailView.tsx:131-171` loads `limit: 100` and searches locally for a global character ID.
- `ProjectCharactersTab.tsx:93-117` does the same for totals and percentages.
- `CharacterController.java:21-28` exposes only the paginated list, not an owned global-character detail endpoint.

Impact: valid characters after page 100 appear missing; counts and progress percentages become inaccurate.

Recommendation: add an authorized `GET /characters/{id}` and server-side aggregate/count queries. Keep collection UIs paginated or infinite rather than treating a page as the full dataset.

### NX-016 — P2 — Missing `maxAuthorizedCost` produces a server error

Evidence:

- `CreateMediaJobRequest.java:8-12` uses `@DecimalMin` but not `@NotNull`.
- `CreateMediaJobUseCase.java:74,118-119` dereferences the value.

Impact: an omitted JSON field can cause a null dereference and HTTP 500 instead of a stable validation response.

Recommendation: add `@NotNull`, domain validation, and an integration test asserting HTTP 400 with a stable error code.

### NX-017 — P2 — Frontend runtime validation accepts malformed asset responses

Evidence:

- `assets.api.ts:4-16` defines a richer asset contract.
- `assets.api.ts:43-61` validates only a small subset before accepting the page.

Impact: malformed or drifting API responses pass the boundary and can fail later in rendering or logic with less actionable errors.

Recommendation: use complete schemas (for example generated OpenAPI types plus Zod validation at trust boundaries) and add malformed-response tests.

### NX-018 — P2 — Frontend token rule is widely violated and not enforced

Evidence:

- A static scan found more than 600 direct Tailwind palette utilities across more than 60 frontend files; examples include `components/ui/Badge.tsx:19-23` and `features/auth/AuthScreen.tsx:104-106`.
- `scripts/check-architecture.mjs:67-71` rejects hard-coded hex values but does not reject direct palette utilities.
- `CharacterDetailView.tsx:59-89` and `ProjectCharactersTab.tsx:30-61` also duplicate role normalization/style mappings and disagree on the `MAIN` role's presentation.

Impact: visual semantics drift, theme changes require broad edits, and green lint output gives a false sense that the repository rule is enforced.

Recommendation: migrate shared states/roles to semantic token classes, centralize the typed role presentation mapping, and expand the architecture check to reject disallowed palette utilities in component code.

### NX-019 — P2 — Dashboard cursor pagination is offset pagination in disguise

Evidence:

- `GetProjectDashboardUseCase.java:70-85` Base64-encodes an offset as a cursor.
- `ProjectDashboardMapper.xml:59-60` uses `OFFSET/LIMIT` over mutable sort orders.
- Substring search uses leading wildcards, while the schema has no matching trigram index.

Impact: inserts/updates between requests cause duplicates or skipped projects, and deep pages/substring searches become increasingly expensive.

Recommendation: use a versioned sort-specific keyset cursor containing the last sort values plus ID. If measured search volume warrants it, enable `pg_trgm` and add a GIN/GiST trigram index rather than relying on a normal B-tree for `%term%` queries.

## Refactoring and technology recommendations

These changes improve depth and maintainability without violating the modular-monolith boundary:

- Replace hand-written SigV4/object-store request construction in the infrastructure adapter with the AWS SDK v2 S3 presigner/client where compatible with R2. This reduces cryptographic canonicalization and timeout/retry mistakes while keeping SDK types out of the domain.
- Introduce a deep upload-finalization module whose narrow interface owns policy, reservation state, remote verification, compare-and-set completion, and cleanup scheduling.
- Split the 900+ line `CharacterDetailView` into a state/model hook and focused tab modules; expose user-level operations rather than pass-through query plumbing.
- Generate frontend DTO types from the backend OpenAPI contract and apply runtime schemas only at external trust boundaries.
- Replace the authentication rate limiter's outage fallback full-map cleanup with a bounded expiring cache such as Caffeine or periodic bucket eviction; `AuthRateLimiter.java:100-118` currently scans up to the entire fallback map on each request.
- Keep PostgreSQL authoritative and the application a modular monolith. The evidence does not justify microservices; the largest gains are stricter state machines, immutable manifests, bounded I/O, and better query/API shapes.

## Verification performed

- Frontend unit tests: passed (5 tests).
- Frontend architecture lint: passed, with the token-enforcement blind spot noted above.
- Frontend TypeScript check: passed.
- Frontend production build: passed (11 routes/pages).
- Backend tests: not run because no Java runtime / `JAVA_HOME` was available in the environment.
- Worker tests, Ruff, MyPy, and repository secret script: not run because no Python runtime was available.
- Dependency advisory audit: not completed. The sandbox could not reach the npm registry, and escalation was not authorized because it would transmit dependency metadata externally.
- The remediation changed frontend API/route code. Browser verification reached the unauthenticated `/characters` and `/projects` flows on the local Next.js server and captured screenshots; authenticated project/character flows require the out-of-band E2E credentials and were not submitted through the browser.

## Scope notes

This was a source and local-check audit, not a penetration test or production configuration review. Security headers may be supplied by an external proxy/CDN; none were visible in `next.config.mjs`, so CSP, frame protection, content-type protection, referrer policy, and permissions policy should be verified at the deployed edge before release.

## Remediation follow-up

The following fixes were applied after the initial audit: E2E example placeholders and scanner coverage; local-only demo migration (`db/local-migration/V3__seed_demo_data.sql`); provider-computed R2 checksum headers and bounded HTTP requests; server upload allowlists, size caps, rejected-object cleanup, and expiry cleanup; owner-scoped generation idempotency; fail-closed moderation; entitlement quality checks; media/render feature gating; pinned and ownership-checked render-plan references; shared worker provider concurrency; bounded `ffprobe`; strict asset response guards; global character detail/count APIs; null cost validation; and an indexed upload cleanup query.

The image-generation runner module remains intentionally unreachable behind the media-generation gate until its repository implementation is wired to the existing durable provider-operation fence. Character snapshot enrichment and deployment-edge CSP verification still require follow-up. The source now emits baseline security headers from `next.config.mjs`, but the deployed proxy/CDN must still be checked for a restrictive CSP and header preservation.
