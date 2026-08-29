# Deprecated Runtime and Schema Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove deprecated runtime, database, test and maintained-documentation residue while preserving VIDEO selection and web/browser video-generation behavior.

**Architecture:** Treat ADR-0012 and the current project-local media workflows as the runtime boundary. Collapse final rendering to one `LOCAL_DEVICE`/`LOCAL_DESKTOP` model, rewrite the pre-production Flyway baseline to the final shape, then remove only enum/shim paths proven to have no live producer/executor/caller. Keep VIDEO analysis/editor contracts and web-video logic intact.

**Tech Stack:** Java 21/Spring Boot/MyBatis/PostgreSQL/Flyway, Python 3.12/Pydantic/pytest, Electron/React/TypeScript, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-29-deprecated-runtime-schema-cleanup-design.md`

## Global Constraints

- Keep `VisualGenerationMode = IMAGE | VIDEO`, the Analyze Chapter VIDEO option, VIDEO analysis persistence and web/browser video-generation code.
- Final project render executes only in Electron main through FFmpeg/ffprobe under backend assignment/lease control.
- Final MP4 bytes are Desktop-local; backend persists metadata only.
- Generated/imported project media is project-local; R2 is reserved for authenticated account-owned voice-reference/custom-voice storage.
- NarrativeX has not had its first production deployment; edit the V1-V8 baseline directly and do not add compatibility migrations for disposable development data.
- Delete a candidate only after proving there is no current producer, executor, caller or active accepted requirement.
- Preserve or strengthen regression guards that prevent removed architecture from returning.

---

### Task 1: Collapse final-artifact persistence to local-only metadata

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/localexecution/api/controller/LocalProjectRenderController.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/localexecution/application/usecase/LocalProjectRenderUseCase.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/localexecution/application/port/out/LocalProjectRenderStore.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/localexecution/infrastructure/persistence/MyBatisLocalProjectRenderStore.java`
- Modify: `app/backend-service/src/main/resources/mybatis/LocalProjectRenderMapper.xml`
- Modify: `app/backend-service/src/main/resources/db/migration/V4__narration_notifications_and_artifacts.sql`
- Modify: `app/backend-service/src/main/resources/db/migration/V7__indexes.sql`
- Test: local-project-render application/persistence tests under `app/backend-service/src/test/java/com/narrativex/backend/feature/localexecution/`
- Test: `app/backend-service/src/test/java/com/narrativex/backend/architecture/FlywayBaselineStructureTest.java`

**Interfaces:**
- Consumes: Desktop completion contract `{renderFingerprint, localArtifactKey, mimeType, sizeBytes, checksumSha256, durationMs, width, height, fps}`.
- Produces: `LocalProjectRenderStore.CompletionResult` with only local artifact identity/validation metadata; database `final_artifacts` without remote external-file/link columns.

- [ ] **Step 1: Add failing local-only persistence assertions**

Add assertions that the Flyway baseline does not contain `external_file_id`, `web_view_link`, `idx_final_artifacts_external_file_id`, or `DEFAULT 'R2'` in the `final_artifacts` definition, and that local render completion cannot carry remote artifact metadata.

- [ ] **Step 2: Run focused backend tests and verify RED**

Run:

```bash
cd app/backend-service
./mvnw -q -Dtest=FlywayBaselineStructureTest,*LocalProjectRender* test
```

Expected: the new assertions fail against the current remote-compatible final-artifact model.

- [ ] **Step 3: Remove remote completion DTO fields and compatibility overloads**

Make the completion result exactly:

```java
public record CompletionResult(
    String renderFingerprint,
    String localArtifactKey,
    String mimeType,
    long sizeBytes,
    String checksumSha256,
    long durationMs,
    int width,
    int height,
    int fps) {}
```

Remove `storageProvider`, `externalFileId`, `webViewLink` from the application/store completion DTOs and remove the compatibility overload that only adapts the old outbound DTO.

- [ ] **Step 4: Rewrite `final_artifacts` clean baseline**

Keep `storage_key` as the opaque project-relative/local artifact key. Remove `external_file_id` and `web_view_link`. If `storage_provider` has no current reader after repository audit, remove it; otherwise make it explicit local metadata with `DEFAULT 'LOCAL_DESKTOP'` and a local-only check. Remove the external-file index from V7.

- [ ] **Step 5: Update MyBatis completion SQL**

Insert/update only the columns retained in Step 4. Project-render completion must persist local artifact metadata and never write an R2/default remote provider.

- [ ] **Step 6: Re-run focused backend tests**

Run the same Maven command. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/backend-service
 git commit -m "refactor(backend): make final artifacts local-only"
```

---

### Task 2: Remove cloud/server final-render execution residue

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/enums/RenderExecutionTarget.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/command/CreateProjectRenderCommand.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCase.java`
- Modify: project-render API request/controller files that expose execution target selection
- Modify: `app/backend-service/src/main/resources/db/migration/V5__catalog_generation_and_render_snapshots.sql`
- Modify: MyBatis project-render snapshot mappings if they persist a cloud target
- Test: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCaseTest.java`
- Test: `app/backend-service/src/test/java/com/narrativex/backend/architecture/FlywayBaselineStructureTest.java`
- Test: Desktop render submission contract tests where the client currently sends `executionTarget`

**Interfaces:**
- Consumes: paired eligible `localDeviceId` for every final project render.
- Produces: one local final-render admission path; no cloud/server render cost, stage name or target.

- [ ] **Step 1: Add failing tests for local-only render admission**

Assert that project render creation requires an eligible local device, creates `RENDER_PROJECT_LOCAL`, has zero render execution cost, and exposes no `CLOUD` target in the current request/domain contract.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd app/backend-service
./mvnw -q -Dtest=CreateProjectRenderUseCaseTest,FlywayBaselineStructureTest test
```

Expected: failures from current `CLOUD` branches/enum/schema.

- [ ] **Step 3: Collapse `RenderExecutionTarget`**

Prefer deleting the enum entirely if only `LOCAL_DEVICE` remains and replacing it with the invariant in the command/use case. If the enum is required by persisted snapshot typing, retain only `LOCAL_DEVICE`.

- [ ] **Step 4: Simplify `CreateProjectRenderUseCase`**

Remove `CLOUD_STAGE_NAME`, cloud cost estimation, cloud media compatibility checks, cloud operation naming and target branching. Require `localDeviceId`, validate `PROJECT_RENDER` capability, create a zero-cost reservation/operation plan if the current quota contract still requires one, and create only the local render stage.

- [ ] **Step 5: Rewrite render-snapshot baseline constraints**

Restrict `execution_target` to `LOCAL_DEVICE` or remove the column if it no longer carries information and all consumers can be simplified in the same task.

- [ ] **Step 6: Preserve VIDEO media support for local FFmpeg render**

Do not reject `VIDEO` beat media in the local path. Delete only cloud-specific video restrictions.

- [ ] **Step 7: Re-run backend and Desktop contract checks**

Expected: local render admission tests pass and VIDEO client contracts remain unchanged.

- [ ] **Step 8: Commit**

```bash
git add app/backend-service app/desktop packages/client-contracts
 git commit -m "refactor(render): remove cloud final-render path"
```

---

### Task 3: Remove proven-dead generation/job and worker compatibility residue

**Files:**
- Audit/modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/enums/JobType.java`
- Audit/modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/enums/ResourceClass.java`
- Audit/modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/enums/ProductionMode.java`
- Audit/modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/aggregate/GenerationJob.java`
- Audit/modify: `app/backend-service/src/main/resources/db/migration/V3__generation_billing_and_media.sql`
- Audit/modify: worker `JobType`/`ResourceClass` payload enums in `app/ai-worker/src/narrativex_worker/schema.py`
- Modify when callers are migrated: `app/ai-worker/src/narrativex_worker/config.py`
- Modify when callers are migrated: narration storage/execution modules using `media_local_dir` or `media_storage_mode`
- Test: backend enum/schema tests and worker role/config tests

**Interfaces:**
- Consumes: repository-wide producer/executor/caller evidence for each candidate.
- Produces: the smallest enum/schema/config surface that still covers every current flow, while preserving VIDEO/web-video intent.

- [ ] **Step 1: Build the live-job matrix from exact-head searches**

For each candidate `STORY_ANALYZE`, `IMAGE_GENERATE`, `CHAPTER_RENDER`, `PROJECT_CONTINUE`, `VISUAL_BEAT_PLAN`, `RENDER_SHORT`, `HYBRID_LOCAL_I2V`, and nonessential `ResourceClass` values, record whether a non-test production producer/executor/caller exists. Historical docs and enum self-references do not count as runtime use.

- [ ] **Step 2: Add regression assertions for values proven dead**

Update Flyway/enum tests so removed values cannot remain in Java, Python or PostgreSQL checks. Explicitly assert that `IMAGE` and `VIDEO` analysis modes remain supported.

- [ ] **Step 3: Run focused backend/worker tests and verify RED**

```bash
cd app/backend-service && ./mvnw -q -Dtest=FlywayBaselineStructureTest,*GenerationJob* test
cd ../ai-worker && pytest -q tests/test_role_import_safety.py tests/test_config.py
```

Expected: only newly added dead-value guards fail.

- [ ] **Step 4: Remove only values proven dead**

Delete dead enum constants, obsolete `GenerationJob` factories/rehydration overloads that exist only for them, matching Flyway check values and worker payload enum values. Keep all values with a live current path.

- [ ] **Step 5: Handle `HYBRID_LOCAL_I2V` carefully**

If no current executor/caller exists, remove it from current Java/Flyway runtime enums/checks while leaving provider-neutral I2V described only as deferred roadmap intent. Do not remove `VIDEO`, web-video automation, or VIDEO analysis preferences.

- [ ] **Step 6: Migrate worker compatibility aliases before deletion**

If narration still calls `settings.media_local_dir`, change it to `settings.project_media_local_dir`; if it checks `media_storage_mode` only to confirm `local`, replace that branch with the direct project-local invariant. Then delete the compatibility properties and update tests. Do not remove `tts_pricing_catalog_version` unless a separate exact-head search proves no production consumer.

- [ ] **Step 7: Re-run focused backend/worker suites**

Expected: PASS with VIDEO contract preserved.

- [ ] **Step 8: Commit**

```bash
git add app/backend-service app/ai-worker
 git commit -m "refactor: remove dead generation compatibility surface"
```

---

### Task 4: Align maintained docs and add drift guards

**Files:**
- Modify: `README.md`
- Modify: `AI_CONTEXT.md`
- Modify: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`
- Modify: `documentation/product/PRODUCT_SPEC.md`
- Modify: `documentation/product/FEATURE_CATALOG.md`
- Modify: `documentation/architecture/SYSTEM_ARCHITECTURE.md`
- Modify: `documentation/architecture/DATA_FLOW.md`
- Modify: `documentation/architecture/SERVICE_BOUNDARIES.md`
- Modify: `documentation/codebase/AI_WORKER_CODEBASE.md`
- Modify: `documentation/decisions/ADR-0003-media-storage-generation-pipelines-and-external-integrations.md`
- Modify as needed: `documentation/codebase/DATABASE_BASELINE.md`
- Modify: `scripts/check-docs-drift.py`

**Interfaces:**
- Consumes: final exact runtime/storage contracts from Tasks 1-3.
- Produces: one maintained storage/render narrative plus a CI guard preventing stale R2/cloud-render claims.

- [ ] **Step 1: Add docs-drift checks that fail on retired claims**

Guard maintained docs against claims that generated project images/narration are stored in R2, final project render can run on a server/cloud target, or final artifacts use remote external-file/web links. The guard must allow R2 references specifically for voice-reference/custom-voice storage and allow deferred provider-neutral I2V roadmap text.

- [ ] **Step 2: Run docs drift and verify RED**

```bash
python scripts/check-docs-drift.py
```

Expected: FAIL on the currently stale maintained documents.

- [ ] **Step 3: Rewrite maintained storage/render sections**

Use the canonical wording:

```text
Generated/imported project image/audio/video -> project-local storage
Final MP4                                  -> Desktop local artifacts
R2                                         -> account-owned voice reference/custom voice only
PostgreSQL                                 -> ownership/domain/job/artifact metadata
```

State that final rendering is `LOCAL_DEVICE`/Electron FFmpeg only. Keep VIDEO/web-video support and deferred I2V intent where appropriate.

- [ ] **Step 4: Update database/codebase docs for clean baseline**

Document removed final-artifact remote fields and any job/schema values removed in Task 3.

- [ ] **Step 5: Run docs drift and repository gates scripts**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add README.md AI_CONTEXT.md documentation scripts/check-docs-drift.py
 git commit -m "docs: align local media and render source of truth"
```

---

### Task 5: Exact-head verification and PR readiness

**Files:**
- No intended production changes; only minimal fixes if verification exposes a regression caused by Tasks 1-4.

**Interfaces:**
- Consumes: exact branch head after all cleanup commits.
- Produces: a branch where all repository CI gates are green and no deleted architecture references remain unexpectedly.

- [ ] **Step 1: Search exact head for removed runtime/schema terms**

Verify no unexpected production/schema hits remain for:

```text
external_file_id
web_view_link
idx_final_artifacts_external_file_id
RenderExecutionTarget.CLOUD
DEFAULT 'R2' on final_artifacts
removed dead JobType values
removed worker compatibility aliases
```

Historical plans may contain retired terms if clearly historical.

- [ ] **Step 2: Verify preserved VIDEO/web-video surface**

Confirm exact-head hits still exist for:

```text
VisualGenerationMode = IMAGE | VIDEO
Analyze Chapter VIDEO option
backend/worker VIDEO analysis preference validation
web/browser video-generation automation and its tests/contracts
```

- [ ] **Step 3: Run or inspect exact-head CI**

Required jobs:

```text
Repository gates
Backend verify
Desktop check
AI worker checks
```

All must succeed on the same commit SHA.

- [ ] **Step 4: Diagnose any failing gate before changing code**

If a gate fails, identify whether the failure is caused by this cleanup or is baseline/unrelated. Make only the smallest root-cause fix, then obtain a new exact-head CI run.

- [ ] **Step 5: Open/update the cleanup PR only after verification**

PR summary must explicitly state that VIDEO/web-video support was preserved and that the database baseline was rewritten because the project is still pre-production.