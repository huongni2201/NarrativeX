# Device-Local Project Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make projects and project media strictly device/project-local, remove one-value sync/storage abstractions, and keep only account-owned custom voice/reference bytes shared through R2.

**Architecture:** Desktop local catalog is the project-discovery boundary. PostgreSQL keeps durable project/orchestration state, while `media_assets.project_id` is the canonical ownership boundary for project media. Project media has no storage-mode enum; custom voice/reference storage is account-scoped and R2-backed behind the voice-reference subsystem rather than project-media contracts.

**Tech Stack:** Electron/React/TypeScript, Spring Boot, MyBatis/PostgreSQL/Flyway, Python/asyncpg AI worker, Node test runner, JUnit/Testcontainers.

**Spec:** `docs/superpowers/specs/2026-08-29-device-local-project-isolation.md`

## Global Constraints

- Project data is not synchronized across Desktop installations.
- Project media is owned by exactly one project and is never reused across projects by checksum.
- Custom voice/reference assets are account-owned and are the only R2-backed shared media.
- Remove fields/enums that encode a fact with only one possible value.
- No compatibility layer is required for stale pre-release data; baseline migrations may be changed directly.
- MyBatis XML must be parse-tested so malformed XML fails before Spring startup.

---

### Task 1: Lock the project-local Desktop boundary

**Files:**
- Modify: `app/desktop/src/main/local-storage/project-catalog.ts`
- Modify: `app/desktop/src/main/local-storage/project-catalog-ipc.ts`
- Modify: `app/desktop/src/preload/index.ts`
- Modify: `app/desktop/src/preload/types.ts`
- Modify: `app/desktop/src/renderer/features/projects/api/projects.api.ts`
- Modify: `app/desktop/src/renderer/features/projects/queries/projects.queries.ts`
- Modify: `app/desktop/src/renderer/features/workspace/queries/useProjectWorkspace.ts`
- Test: `app/desktop/test/project-catalog.test.mjs`
- Test: `app/desktop/test/device-local-project-isolation.test.mjs`

**Interfaces:**
- Consumes: `window.narrativex.localProjects.list/upsert/touch/markArchived`.
- Produces: project discovery that has no backend-list reconciliation, cloud project id, or sync-status state machine.

- [x] Remove `reconcile`, `cloudProjectId`, and sync-status values from the public preload/IPC surface.
- [x] Make local catalog the only source for project listing.
- [x] Gate project detail and workspace resource queries behind successful local-catalog lookup.
- [x] Make catalog persistence schema local-only and use direct archived state rather than `ORPHANED`.
- [ ] Add source-contract assertions that `syncStatus`, `cloudProjectId`, and `desktop:projects-local:reconcile` no longer appear in runtime project-catalog contracts.
- [ ] Run `node --test app/desktop/test/project-catalog.test.mjs app/desktop/test/device-local-project-isolation.test.mjs` and confirm all tests pass.

### Task 2: Make `media_assets.project_id` the project-media ownership boundary and remove `storage_mode`

**Files:**
- Modify: `app/backend-service/src/main/resources/db/migration/V3__generation_billing_and_media.sql`
- Modify: `app/backend-service/src/main/resources/db/migration/V7__indexes.sql`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/infrastructure/persistence/mybatis/MediaAssetRow.java`
- Modify: `app/backend-service/src/main/resources/mybatis/MediaAssetMapper.xml`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/application/query/MediaAssetView.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/api/response/MediaAssetResponse.java`
- Modify: `packages/client-contracts/src/asset.ts`
- Modify: `packages/client-contracts/src/production.ts`
- Modify: `packages/client-contracts/src/index.ts`
- Test: `app/backend-service/src/test/java/com/narrativex/backend/feature/assets/infrastructure/persistence/adapter/MyBatisMediaAssetRepositoryTest.java`
- Test: `app/desktop/test/asset-api-contract.test.mjs`

**Interfaces:**
- Project media row: `media_assets(id, account_id, project_id NOT NULL, asset_type, origin, storage_key, ... )`.
- Project asset listing: `repository.list(ownerId, projectId, ...)`.
- Desktop asset contracts no longer expose `storageMode`.

- [ ] Write/adjust tests first so they fail while `storage_mode` remains in schema/contracts.
- [ ] Remove `storage_mode` column, default, check constraint, mapper result, row field/getters/setters, DTO/view field, and TypeScript field.
- [ ] Keep `storage_key` nullable: generated/shared-local-runtime project media may have an opaque project-local transport key; direct Desktop imports may have `NULL` because the Desktop manifest is the byte-location authority.
- [ ] Scope all project asset list queries with `project_id = #{projectId}` and account ownership; remove `storage_mode IN (...)` predicates.
- [ ] Update indexes to index project-owned asset reads directly, e.g. `(account_id, project_id, created_at DESC, id DESC)`.
- [ ] Run targeted backend repository/contract tests and Desktop asset contract tests.

### Task 3: Carry `projectId` through every local project-media registration path

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/api/request/RegisterLocalAssetRequest.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/api/controller/AssetLibraryController.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/application/usecase/AssetLibraryUseCase.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/application/port/out/MediaAssetRepository.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/infrastructure/persistence/adapter/MyBatisMediaAssetRepository.java`
- Modify: `app/backend-service/src/main/resources/mybatis/MediaAssetMapper.xml`
- Modify: `packages/client-contracts/src/asset.ts`
- Modify: `app/desktop/src/renderer/features/assets/api/assets.api.ts`
- Test: `app/backend-service/src/test/java/com/narrativex/backend/feature/assets/api/AssetLibraryControllerContractTest.java`
- Test: `app/desktop/test/asset-api-contract.test.mjs`

**Interfaces:**
- `RegisterLocalAssetRequest(UUID projectId, String type, ...)`.
- `CreateLocalMediaAsset(UUID proposedId, UUID projectId, String type, ...)`.
- Backend validates `ProjectAccess.findOwnedProject(projectId, ownerId)` before inserting.

- [x] Add `projectId` to the wire request and repository command.
- [x] Validate project ownership in `AssetLibraryUseCase`.
- [x] Persist `project_id` in `insertLocal`.
- [ ] Ensure `assetsApi.listAll` requires a project id instead of querying an account-global asset library.
- [ ] Thread `projectId` into workspace/editor/voice-screen project-media calls; keep account voice library separate.
- [ ] Add a test proving project A cannot list/get a project-media asset through project B's asset-library route.

### Task 4: Remove cross-project generated-media deduplication and write project ownership in the AI worker

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/image_generation_repository/materialization.py`
- Test: `app/ai-worker/tests/test_image_generation_materialization_uuidv7.py`

**Interfaces:**
- Consumes: `generation_jobs.project_id` and `requested_by_user_id`.
- Produces: one fresh `media_assets.id` per generated project-media result, with that job's `project_id`.

- [x] Stop reading `media_asset_checksums` for generated image reuse.
- [x] Generate a fresh UUIDv7 asset identity for each project result.
- [x] Persist `project_id` on generated image media rows.
- [ ] Remove `storage_mode = 'PROJECT_LOCAL'` from the insert after Task 2 removes the column.
- [ ] Add/adjust the worker test to assert the SQL contains `project_id` and does not query/insert the checksum registry for generated project media.
- [ ] Run the targeted worker test.

### Task 5: Separate account voice-reference storage from project media

**Files:**
- Modify: `app/backend-service/src/main/resources/db/migration/V3__generation_billing_and_media.sql`
- Create or repurpose focused voice-reference persistence types under `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/assets/`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/application/service/MediaUploadFinalizationService.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/assets/VoiceReferenceAssetAccessAdapter.java`
- Modify: upload/validation mappers only as needed to point at the voice-reference asset identity rather than `media_assets`.
- Test: `app/backend-service/src/test/java/com/narrativex/backend/feature/assets/application/usecase/MediaUploadUseCaseTest.java`
- Add/modify voice-reference adapter persistence tests.

**Interfaces:**
- Voice reference metadata has `id`, `account_id`, `storage_key`, filename/content metadata, size/checksum/status and no `project_id` or storage-mode field.
- `VoiceReferenceAssetAccess.findOwned(accountId, id)` reads only the account-scoped voice-reference repository.

- [ ] Write the failing persistence/adapter test proving a voice reference can be retrieved by account without any project/storage-mode field.
- [ ] Add a dedicated `voice_reference_assets` table (or rename the existing account-upload asset table if an equivalent already exists) with account ownership and R2 `storage_key`.
- [ ] Change upload finalization to create/reuse voice-reference rows by `(account_id, sha256)` rather than generic project `media_assets`.
- [ ] Point `VoiceReferenceAssetAccessAdapter` at the new voice-reference repository.
- [ ] Keep `/api/v1/voice-references` contracts project-free and R2-specific.
- [ ] Delete generic media checksum behavior if its only remaining consumer was voice reference and move that uniqueness to the voice-reference table/repository.
- [ ] Run voice upload/finalization/adapter tests.

### Task 6: Remove `storageMode` from production timeline, beat selection, preview and render contracts

**Files:**
- Modify: `app/backend-service/src/main/resources/mybatis/ProductionBeatMediaSelectionMapper.xml`
- Modify: `app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml`
- Modify: production timeline/selection row, port, use-case and response types that expose `storageMode`
- Modify: `packages/client-contracts/src/production.ts`
- Modify: `app/desktop/src/renderer/features/storyboard/model/storyboard-image-preview.ts`
- Modify: `app/desktop/src/renderer/features/storyboard/queries/storyboard-media.queries.ts`
- Modify: `app/desktop/src/renderer/features/production/render-preflight.ts`
- Modify: `app/desktop/src/main/rendering/local-render-preflight.ts`
- Modify: `app/desktop/src/main/rendering/render-manifest.ts`
- Tests: existing production, storyboard-media and render tests.

**Interfaces:**
- Beat selection validates only `project_id`, `account_id`, status/deletion, media type, size and checksum.
- Project media preview resolves by `localAssetPreviewUrl(projectId, assetId)` without remote fallback branching.
- Render preflight assumes all project media is local and checks manifest availability/integrity directly.

- [ ] First update contract tests to reject any `storageMode` field/enum in project-media contracts.
- [ ] Remove `ma.storage_mode` select/result/predicate usage from MyBatis timeline and selection mappers.
- [ ] Remove Java `storageMode` fields and TypeScript `BeatMediaStorageMode`/asset storage-mode types.
- [ ] Simplify storyboard preview resolution to local preview identity only; do not request `/download-url` for project media.
- [ ] Simplify render preflight/manifest code to local availability/integrity checks with no remote/hybrid branch.
- [ ] Run backend production tests and Desktop storyboard/render tests.

### Task 7: Remove dead `local_media_materializations` ownership machinery

**Files:**
- Modify: `app/backend-service/src/main/resources/db/migration/V3__generation_billing_and_media.sql` or the baseline migration that defines the table.
- Modify: `app/backend-service/src/main/resources/db/migration/V7__indexes.sql`.
- Delete unused mapper/repository/controller types only after repository search confirms no runtime writer/reader remains.
- Modify tests/docs that describe materialization ownership inference.

**Interfaces:**
- Project ownership is `media_assets.project_id`; Desktop manifest is local byte-location state.

- [ ] Repository-search runtime references to `local_media_materializations` and confirm no independent device-health feature requires it.
- [ ] Remove the table/indexes and dead Java/MyBatis contracts if unused.
- [ ] Keep Desktop manifest verification as the runtime check for actual bytes on the current device.
- [ ] Run schema/bootstrap and local-render tests.

### Task 8: Mapper XML regression and architecture docs

**Files:**
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/architecture/ProductionBeatMediaSelectionScopeContractTest.java`
- Add or extend an architecture test that parses every file under `src/main/resources/mybatis/*.xml`.
- Modify: `documentation/decisions/ADR-0012-desktop-local-first-media-and-render-execution.md`
- Modify stale local/R2 docs found by search.

**Interfaces:**
- Any malformed mapper XML fails CI before application context startup.

- [x] Fix the original malformed `<>` mapper regression by removing the branch that introduced it.
- [ ] Generalize the regression test from one mapper to all MyBatis XML mapper files.
- [ ] Update ADR wording to state R2 is voice-reference-only and project media has no storage-mode abstraction.
- [ ] Remove stale docs that describe remote-backed project preview/download fallback as current architecture.

### Task 9: Full verification and PR

- [ ] Run backend verify including mapper parse/bootstrap tests.
- [ ] Run Desktop tests/check/typecheck.
- [ ] Run relevant AI-worker tests/static checks.
- [ ] Compare `main...feat/device-local-project-isolation` and review every changed file for unrelated edits.
- [ ] Bring the branch up to date with the latest `main` without losing the hard-cutover changes.
- [ ] Create a PR summarizing: original MyBatis XML regression, direct project ownership, one-value abstraction removal, device-local catalog isolation, and voice-only R2 boundary.
