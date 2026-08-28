# Local Project Media + R2 Voice-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all NarrativeX project media persist locally while reserving Cloudflare R2 exclusively for authenticated account-owned voice-reference/custom-voice assets.

**Architecture:** Production workers receive explicit storage dependencies instead of selecting a shared storage mode. Project output always uses `LocalMediaStorage(PROJECT_MEDIA_LOCAL_DIR)`, while narration custom-voice reads use an R2-backed voice-reference store. Backend R2 upload routes are narrowed to voice-reference uploads with account-scoped keys; local project media continues through native/local registration and materialization flows.

**Tech Stack:** Python 3 asyncio workers, pytest, Java/Spring Boot backend, JUnit/Mockito, Electron/TypeScript, Vitest/Node tests, Docker Compose, Cloudflare R2 S3 API.

**Spec:** `docs/superpowers/specs/2026-08-28-local-project-media-r2-voice-only-design.md`

## Global Constraints

- Hard cutover before deployment: no migration, dual-write, legacy R2 project-media read, or fallback behavior.
- All project media is local filesystem data; PostgreSQL persists logical keys/metadata only, never absolute host/container paths.
- R2 is reserved for account-owned voice-reference/custom-voice assets.
- New R2 voice keys are account-scoped under `voices/<account-id>/...` (or an equivalent opaque account-scoped prefix).
- Narration uses separate `project_media_storage` and `voice_reference_storage` dependencies.
- Image generation uses local project storage only.
- R2 voice uploads remain durable and validated before READY.
- PostgreSQL durable generation queue behavior is unchanged.

---

### Task 1: Make project-media storage explicit and local-only in worker configuration

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/config.py`
- Modify: `app/ai-worker/src/narrativex_worker/narration/storage.py`
- Test: `app/ai-worker/tests/test_config.py`
- Test: `app/ai-worker/tests/test_storage.py` or the existing storage test module discovered in the repo

**Interfaces:**
- Produces: `WorkerSettings.project_media_local_dir: str`
- Produces: an R2 constructor usable only for voice-reference access; production project-media construction no longer depends on `media_storage_mode`.
- Preserves: `LocalMediaStorage` and `S3MediaStorage` protocol behavior for focused tests and voice R2 access.

- [ ] **Step 1: Write failing config tests**

Add tests proving `PROJECT_MEDIA_LOCAL_DIR` configures the project local root and that `MEDIA_STORAGE_MODE=r2` is no longer a supported/required project-output selector.

```python
def test_project_media_local_dir_is_explicit(monkeypatch):
    monkeypatch.setenv("PROJECT_MEDIA_LOCAL_DIR", "/tmp/narrativex-project-media")
    settings = WorkerSettings()
    assert settings.project_media_local_dir == "/tmp/narrativex-project-media"
```

Add a test that production project storage construction never returns `S3MediaStorage` merely because R2 credentials are configured.

- [ ] **Step 2: Run focused worker config/storage tests and verify RED**

Run from `app/ai-worker`:

```bash
pytest -q tests/test_config.py tests/test_storage.py
```

Expected: at least the new explicit project-media configuration/storage-selection assertion fails because current code still exposes/uses `MEDIA_STORAGE_MODE` for production project output.

- [ ] **Step 3: Implement minimal explicit configuration**

In `WorkerSettings`, introduce/read `PROJECT_MEDIA_LOCAL_DIR` (preserving a safe local default). Remove production branching that treats `MEDIA_STORAGE_MODE` as a project-output selector. Keep R2 endpoint/bucket/credential settings because voice-reference R2 still needs them.

- [ ] **Step 4: Keep storage primitives responsibility-focused**

Retain `LocalMediaStorage` and `S3MediaStorage`, but adjust constructor validation/naming/comments so `S3MediaStorage` does not require a generic project-media mode flag. It should validate only R2 connection settings needed for voice-reference access.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
pytest -q tests/test_config.py tests/test_storage.py
```

Expected: PASS.

---

### Task 2: Split narration output storage from voice-reference storage

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/narration/runner/implementation.py`
- Modify: `app/ai-worker/src/narrativex_worker/narration/local_runner.py`
- Modify: `app/ai-worker/src/narrativex_worker/__main__.py` if construction is centralized there
- Test: existing narration runner/local-runner tests under `app/ai-worker/tests/`

**Interfaces:**
- Produces on `NarrationWorkerRunner`: `project_media_storage: MediaStorage`
- Produces on `NarrationWorkerRunner`: `voice_reference_storage: MediaStorage`
- Preset/local narration writes final `chapter.mp3` only through `project_media_storage`.
- Custom voice downloads `claimed.voice_reference_storage_key` only through `voice_reference_storage`.

- [ ] **Step 1: Write failing narration tests**

Add a test with two recording/fake stores. Assert a preset-voice narration writes final output to project storage and never touches voice storage. Add a custom-voice test asserting reference download hits voice storage while final MP3 writes hit project storage.

Representative assertion shape:

```python
assert project_store.put_file_calls
assert voice_store.download_calls == [claimed.voice_reference_storage_key]
assert not voice_store.put_file_calls
```

Also assert the local runner log no longer contains `R2 upload confirmed` for local output.

- [ ] **Step 2: Run focused narration tests and verify RED**

```bash
pytest -q tests -k "narration and (storage or reference or local)"
```

Expected: FAIL because current runner uses one `self.storage` object for both reference download and final project output.

- [ ] **Step 3: Implement separate dependencies**

Construct `project_media_storage = LocalMediaStorage(settings.project_media_local_dir)` for every enabled narration worker. Construct `voice_reference_storage = S3MediaStorage(settings)` only for custom voice-reference reads. Route reference download through the voice store and every generated segment/final project artifact through the local project store.

- [ ] **Step 4: Remove misleading local R2 semantics**

Rename fields/log text from generic `storage`/`R2 upload confirmed` to project-media or voice-reference terminology. Do not add fallback from failed local writes to R2.

- [ ] **Step 5: Run focused narration tests and verify GREEN**

```bash
pytest -q tests -k "narration or voice_reference"
```

Expected: PASS.

---

### Task 3: Force image generation project output to local storage

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/image_generation_worker.py`
- Modify/delete if obsolete: `app/ai-worker/src/narrativex_worker/provider_image_storage_smoke.py`
- Test: image-generation worker tests under `app/ai-worker/tests/`

**Interfaces:**
- Image worker production storage is always `LocalMediaStorage(settings.project_media_local_dir)`.
- R2 configuration has no effect on generated image output selection.
- Image provider reference-store behavior must use project-local assets where the reference is project media.

- [ ] **Step 1: Write failing image storage-selection test**

Instantiate the image worker with R2 credentials present and assert its production storage is local and rooted at `PROJECT_MEDIA_LOCAL_DIR`.

```python
assert isinstance(worker.storage, LocalMediaStorage)
assert worker.storage.root == Path(settings.project_media_local_dir).resolve()
```

- [ ] **Step 2: Run focused image tests and verify RED**

```bash
pytest -q tests -k "image_generation and storage"
```

Expected: FAIL because `_configured_storage` currently returns `S3MediaStorage` for the generic R2 mode.

- [ ] **Step 3: Implement local-only image output**

Delete the project-output R2 branch from `_configured_storage`; simplify to direct `LocalMediaStorage(settings.project_media_local_dir)` construction. Remove obsolete smoke paths whose only purpose is proving provider output through R2.

- [ ] **Step 4: Run focused image tests and verify GREEN**

```bash
pytest -q tests -k "image_generation"
```

Expected: PASS.

---

### Task 4: Narrow backend R2 upload/finalization to account-owned voice references

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/api/controller/AssetLibraryController.java`
- Modify/create: a dedicated voice-reference upload controller/use-case in the existing generation/voice feature boundary
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/application/usecase/MediaUploadUseCase.java` or replace its public usage with a voice-specific wrapper
- Modify: upload session/repository code only as needed for account-scoped storage keys
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/assets/VoiceReferenceAssetAccessAdapter.java` only if contract tightening is needed
- Modify: `app/desktop/src/main/api/backend-sse-ipc.ts`
- Test: `app/backend-service/src/test/java/com/narrativex/backend/feature/assets/application/usecase/MediaUploadUseCaseTest.java`
- Test: controller contract tests for asset/voice upload routes
- Test: desktop voice upload tests if present

**Interfaces:**
- Voice upload API is semantically voice-reference-specific rather than a generic project-media R2 route.
- `createIntent` derives `accountId = currentUserId.get()` and generates `voices/<safe-account-scope>/<upload-id>` (or equivalent opaque account-scoped key).
- Accepted types are voice-reference audio only (MP3/WAV matching current Desktop picker support).
- Finalized media asset remains owned by authenticated account and usable by `findOwned(accountId, id)` only after READY.

- [ ] **Step 1: Write failing backend tests for account-scoped voice keys and restriction**

Add assertions that two accounts produce keys in separate account scopes and that IMAGE/VIDEO R2 upload intents are rejected. Assert MP3/WAV audio intents succeed.

Representative expectation:

```java
assertThat(intent.storageKey()).startsWith("voices/account-a/");
assertThatThrownBy(() -> useCase.createIntent(imageRequest, null))
    .isInstanceOf(IllegalArgumentException.class);
```

- [ ] **Step 2: Run focused backend tests and verify RED**

From `app/backend-service` run the repository's Gradle/Maven wrapper for the focused upload/controller tests.

Expected: FAIL because current key is `media/uploads/<id>` and generic IMAGE/VIDEO uploads are accepted.

- [ ] **Step 3: Implement account-scoped voice-only upload contract**

Move/expose the upload endpoints under a voice-reference-specific API path, restrict content types to the existing MP3/WAV voice picker contract, generate account-scoped R2 keys, and remove generic R2 upload-intent routes from `AssetLibraryController`. Keep local `/api/v1/assets/local` registration for project media.

- [ ] **Step 4: Update Desktop custom voice uploader**

Change Electron main to call the dedicated voice-reference upload/finalize endpoints. Preserve native picker, checksum, idempotency, presigned PUT, and finalize behavior.

- [ ] **Step 5: Run focused backend + desktop tests and verify GREEN**

Run focused backend tests, then the desktop test command targeting voice upload/feature-boundary tests.

Expected: PASS.

---

### Task 5: Keep R2 validation voice-only and remove legacy project-R2 configuration/docs

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/media_validation_worker.py`
- Modify: `docker-compose.yml`
- Modify: relevant `.env.example` / environment documentation discovered in repo
- Modify: `documentation/workflows/NARRATION_AUDIO.md`
- Modify: other source-of-truth docs that still describe R2 project-media transport as normal behavior
- Modify: worker/container/config tests referencing `MEDIA_STORAGE_MODE`

**Interfaces:**
- Durable R2 validation worker validates only voice-reference upload jobs.
- Compose passes `PROJECT_MEDIA_LOCAL_DIR` into narration/image workers and mounts the shared local project-media root.
- R2 credentials remain available only to backend voice upload/finalization and narration/voice-validation components that need them.

- [ ] **Step 1: Write/adjust failing boundary tests**

Add assertions that media validation does not become enabled due to a generic project-media R2 mode and that container configuration no longer declares `MEDIA_STORAGE_MODE=r2` for narration/image project output.

- [ ] **Step 2: Run focused config/container tests and verify RED**

```bash
pytest -q tests/test_config.py tests/test_worker_container.py
```

Expected: FAIL against legacy compose/config expectations.

- [ ] **Step 3: Clean worker/compose configuration**

Rename validation responsibility/logging where practical to voice-reference validation, remove `MEDIA_STORAGE_MODE` from production project-media configuration, mount one shared local media root for worker output, and keep required R2 settings only on voice-related paths.

- [ ] **Step 4: Update docs and delete dead legacy tests/code**

Update storage contract docs to state `Generated narration/images/imported media/final artifacts -> local`, `voice reference/custom voice -> R2`. Delete obsolete R2 project-media smoke tests/code after verifying no runtime caller remains.

- [ ] **Step 5: Run full relevant verification**

AI worker:

```bash
pytest -q
```

Backend: run the repository's full backend test command.

Desktop: run the repository's desktop test/typecheck commands.

Compose:

```bash
docker compose config
```

Repository boundary scan:

```bash
git grep -n "MEDIA_STORAGE_MODE\|R2 upload confirmed\|media/uploads/"
```

Expected: no production project-media R2 selection, misleading local-output R2 log, or generic `media/uploads/` R2 key remains. Any remaining R2 references are voice-reference/custom-voice infrastructure or docs explaining that boundary.

---

### Task 6: Final review, verification, and PR

**Files:**
- Review all branch changes against the approved spec.

**Interfaces:**
- No new interfaces; this task proves the end-to-end storage boundary.

- [ ] **Step 1: Review diff for forbidden compatibility behavior**

Confirm there is no migration, dual-write, project-media R2 fallback, or legacy-read branch.

- [ ] **Step 2: Re-run targeted/full verification after final cleanup**

Run worker, backend, desktop, compose, and repository-boundary checks from Task 5.

- [ ] **Step 3: Commit final cleanup if needed**

Use a focused commit message such as:

```bash
git commit -m "refactor: keep project media local and R2 voice-only"
```

- [ ] **Step 4: Push branch and create PR**

Create a PR from `refactor/local-project-media-r2-voice-only` into `main` summarizing the storage boundary, hard cutover, and verification results.
