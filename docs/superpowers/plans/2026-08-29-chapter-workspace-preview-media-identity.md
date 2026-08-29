# Chapter Workspace Preview Media Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the obsolete Chapter Workspace `previewImageUrl` path and make `previewMediaAssetId` the sole scene-preview identity from PostgreSQL through the Desktop runtime contract.

**Architecture:** The backend projects the first non-null `visual_beats.preview_media_asset_id` for each current Scene and carries that UUID through the read port and API response. Shared/Desktop contracts carry only the stable media identity; Desktop keeps using the existing asset lookup/local preview resolver when a UI surface needs a renderable URL.

**Tech Stack:** Java 25, Spring Boot, MyBatis, PostgreSQL, Testcontainers, TypeScript, Electron/React, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-29-chapter-workspace-preview-media-identity-design.md`

## Global Constraints

- Do not reintroduce `visual_beats.preview_asset_id`.
- Do not use `project_assets.url` as Chapter Workspace preview identity.
- Do not expose absolute local filesystem paths from backend contracts.
- Use `previewMediaAssetId: string | null` / `UUID previewMediaAssetId` as the only Chapter Workspace preview-media field.
- Reuse the existing Desktop Storyboard media preview resolution path if Chapter Workspace later renders thumbnails; do not duplicate it in this change.
- Do not add a new Chapter Workspace thumbnail UI in this change.

---

### Task 1: Project canonical preview media identity from PostgreSQL

**Files:**
- Modify: `app/backend-service/src/main/resources/mybatis/ChapterWorkspaceMapper.xml`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/mybatis/ChapterWorkspacePreviewRow.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisChapterWorkspaceQueryAdapter.java`
- Modify/Test: `app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisChapterWorkspaceQueryAdapterTest.java`
- Test: `app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/api/ChapterWorkspacePreviewMediaIntegrationTest.java`

**Interfaces:**
- Consumes: `visual_beats.preview_media_asset_id UUID` from the current database baseline.
- Produces: `ChapterWorkspacePreviewRow#getPreviewMediaAssetId(): UUID` and `ChapterWorkspaceAccess.PreviewScene.previewMediaAssetId(): UUID` for Task 2.

- [ ] **Step 1: Strengthen the adapter regression test before production edits**

Add a test that constructs a `ChapterWorkspacePreviewRow` with a UUID preview media identity and proves the adapter copies it into the snapshot:

```java
@Test
void previewSceneKeepsCanonicalPreviewMediaAssetIdentity() {
  UUID previewMediaAssetId = UuidV7.random();
  ChapterWorkspaceAggregateRow aggregate = new ChapterWorkspaceAggregateRow();
  ChapterWorkspacePreviewRow preview = new ChapterWorkspacePreviewRow();
  preview.setId(UuidV7.random());
  preview.setTitle("Scene");
  preview.setStatus("DRAFT");
  preview.setPreviewMediaAssetId(previewMediaAssetId);

  ChapterWorkspaceMapper mapper = mock(ChapterWorkspaceMapper.class);
  when(mapper.aggregate(PROJECT_ID, CHAPTER_ID)).thenReturn(aggregate);
  when(mapper.previewScenes(PROJECT_ID, CHAPTER_ID)).thenReturn(List.of(preview));

  var snapshot = new MyBatisChapterWorkspaceQueryAdapter(mapper).get(PROJECT_ID, CHAPTER_ID);

  assertEquals(previewMediaAssetId, snapshot.previewScenes().getFirst().previewMediaAssetId());
}
```

- [ ] **Step 2: Verify the new contract is RED on the current production model**

Run from `app/backend-service`:

```bash
./mvnw --batch-mode --no-transfer-progress -Dtest=MyBatisChapterWorkspaceQueryAdapterTest test
```

Expected on the pre-clean production model: test compilation fails because `setPreviewMediaAssetId(...)` / `previewMediaAssetId()` do not yet exist. If repository-wide stale tests prevent Maven test compilation earlier, record that baseline blocker and continue with production compile plus CI evidence; do not weaken the regression assertion.

- [ ] **Step 3: Replace the row field with UUID media identity**

Change `ChapterWorkspacePreviewRow` from:

```java
private String previewImageUrl;
```

to:

```java
private UUID previewMediaAssetId;
```

- [ ] **Step 4: Replace the mapper result and SQL projection**

Change the preview result mapping to:

```xml
<result property="previewMediaAssetId" column="preview_media_asset_id"/>
```

Change `previewScenes()` to select the first attached preview identity in deterministic beat order:

```sql
SELECT s.id, s.order_index, s.title, s.duration_seconds, s.status,
       COUNT(vb.id)::int AS visual_beat_count,
       (
           array_agg(vb.preview_media_asset_id ORDER BY vb.order_index, vb.id)
           FILTER (WHERE vb.preview_media_asset_id IS NOT NULL)
       )[1] AS preview_media_asset_id
  FROM chapters c
  JOIN scenes s ON s.storyboard_revision_id = c.current_storyboard_revision_id
  LEFT JOIN visual_beats vb ON vb.scene_id = s.id
 WHERE c.id = #{chapterId}
   AND c.deleted_at IS NULL
   AND s.status &lt;&gt; 'OUTDATED'
 GROUP BY s.id, s.order_index, s.title, s.duration_seconds, s.status
 ORDER BY s.order_index ASC, s.id ASC
 LIMIT 4
```

There must be no `project_assets` join and no `preview_asset_id` reference.

- [ ] **Step 5: Update adapter mapping**

Change `toPreview(...)` to pass:

```java
row.getPreviewMediaAssetId()
```

instead of `row.getPreviewImageUrl()`.

- [ ] **Step 6: Keep the PostgreSQL regression test canonical**

The existing branch test `ChapterWorkspacePreviewMediaIntegrationTest` must continue to seed:

```sql
visual_beats.preview_media_asset_id = MEDIA_ASSET_ID
```

and assert:

```java
jsonPath("$.data.previewScenes[0].previewMediaAssetId")
    .value(MEDIA_ASSET_ID.toString())
```

plus absence of `previewImageUrl`.

- [ ] **Step 7: Verify production compilation and the focused test when the baseline permits it**

Run:

```bash
./mvnw --batch-mode --no-transfer-progress -Dmaven.test.skip=true package
./mvnw --batch-mode --no-transfer-progress -Dtest=MyBatisChapterWorkspaceQueryAdapterTest test
```

Expected: production package exits 0; focused unit test exits 0 once repository test compilation is clean enough to execute it.

- [ ] **Step 8: Commit Task 1**

```bash
git add app/backend-service/src/main/resources/mybatis/ChapterWorkspaceMapper.xml \
  app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/mybatis/ChapterWorkspacePreviewRow.java \
  app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisChapterWorkspaceQueryAdapter.java \
  app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisChapterWorkspaceQueryAdapterTest.java \
  app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/api/ChapterWorkspacePreviewMediaIntegrationTest.java
git commit -m "fix(storyboard): project workspace preview media identity"
```

---

### Task 2: Carry `previewMediaAssetId` through the backend API contract

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/port/in/ChapterWorkspaceAccess.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/api/response/ChapterWorkspaceResponse.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/usecase/GetChapterWorkspaceUseCase.java`
- Modify/Test: `app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/api/StoryboardApiIntegrationTest.java`

**Interfaces:**
- Consumes: `UUID previewMediaAssetId` from Task 1.
- Produces: JSON `previewScenes[].previewMediaAssetId: string | null` with no `previewImageUrl`, consumed by Task 3.

- [ ] **Step 1: Update the stale integration expectation before changing the API records**

In `chapterWorkspaceProjectsNarrationAndRenderStateFromDurableRows`, remove the obsolete statement:

```java
jdbcTemplate.update(
    "UPDATE visual_beats SET preview_asset_id = ? WHERE id = ?", PROJECT_ASSET, BEAT_1);
```

and replace it with:

```java
jdbcTemplate.update(
    "UPDATE visual_beats SET preview_media_asset_id = ? WHERE id = ?",
    PREVIEW_MEDIA_ASSET,
    BEAT_1);
```

Replace the `previewImageUrl` assertion with:

```java
.andExpect(
    jsonPath("$.data.previewScenes[0].previewMediaAssetId")
        .value(PREVIEW_MEDIA_ASSET.toString()))
.andExpect(jsonPath("$.data.previewScenes[0].previewImageUrl").doesNotExist())
```

- [ ] **Step 2: Change the read-port record**

Change `ChapterWorkspaceAccess.PreviewScene` final field from:

```java
String previewImageUrl
```

to:

```java
UUID previewMediaAssetId
```

- [ ] **Step 3: Change the API response record**

Change `ChapterWorkspaceResponse.PreviewScene` final field from:

```java
String previewImageUrl
```

to:

```java
UUID previewMediaAssetId
```

- [ ] **Step 4: Change the use-case mapping**

Change:

```java
scene.previewImageUrl()
```

to:

```java
scene.previewMediaAssetId()
```

- [ ] **Step 5: Verify backend production compilation**

Run from `app/backend-service`:

```bash
./mvnw --batch-mode --no-transfer-progress -Dmaven.test.skip=true package
```

Expected: exit 0 with no reference to `previewImageUrl` in backend production code.

- [ ] **Step 6: Run the PostgreSQL workspace integration tests when test compilation reaches them**

Run:

```bash
./mvnw --batch-mode --no-transfer-progress -Dtest=ChapterWorkspacePreviewMediaIntegrationTest,StoryboardApiIntegrationTest test
```

Expected: both tests pass. If unrelated baseline test-compilation errors stop execution, capture the exact errors separately rather than changing this feature's contract back for compatibility.

- [ ] **Step 7: Commit Task 2**

```bash
git add app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/port/in/ChapterWorkspaceAccess.java \
  app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/api/response/ChapterWorkspaceResponse.java \
  app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/usecase/GetChapterWorkspaceUseCase.java \
  app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/api/StoryboardApiIntegrationTest.java
git commit -m "refactor(storyboard): expose workspace preview media id"
```

---

### Task 3: Align shared and Desktop runtime contracts

**Files:**
- Modify: `packages/client-contracts/src/chapter.ts`
- Modify: `app/desktop/src/renderer/features/chapters/api/chapter-workspace-contract.ts`
- Modify/Test: `app/desktop/test/chapter-voice-contracts.test.mjs`

**Interfaces:**
- Consumes: backend JSON `previewScenes[].previewMediaAssetId: string | null` from Task 2.
- Produces: typed `ChapterWorkspacePreviewScene.previewMediaAssetId: string | null` accepted by `parseChapterWorkspace(...)`.

- [ ] **Step 1: Make the Desktop fixture require the new field**

Change the workspace fixture from:

```js
previewImageUrl: null,
```

to:

```js
previewMediaAssetId: "00000000-0000-4000-8000-000000091007",
```

Add assertions:

```js
assert.equal(
  parseChapterWorkspace(workspace).previewScenes[0].previewMediaAssetId,
  "00000000-0000-4000-8000-000000091007",
);

const legacyPreviewShape = structuredClone(workspace);
delete legacyPreviewShape.previewScenes[0].previewMediaAssetId;
legacyPreviewShape.previewScenes[0].previewImageUrl = "https://legacy.example/preview.png";
assert.throws(() => parseChapterWorkspace(legacyPreviewShape), /contract/);
```

- [ ] **Step 2: Run the Desktop contract test to verify RED**

Run from `app/desktop`:

```bash
node --test test/chapter-voice-contracts.test.mjs
```

Expected before contract edits: FAIL because the parser still requires `previewImageUrl`.

- [ ] **Step 3: Change the shared TypeScript contract**

Change `ChapterWorkspacePreviewScene` from:

```ts
previewImageUrl: string | null;
```

to:

```ts
previewMediaAssetId: string | null;
```

- [ ] **Step 4: Change the Desktop runtime parser**

Replace:

```ts
isNullableString(value.previewImageUrl)
```

with:

```ts
isNullableString(value.previewMediaAssetId)
```

No new local-media resolver is needed in the Chapter Workspace parser.

- [ ] **Step 5: Run the Desktop contract test to verify GREEN**

Run:

```bash
node --test test/chapter-voice-contracts.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run full Desktop verification**

Run:

```bash
npm run check
```

Expected: tests, type-check and build all pass.

- [ ] **Step 7: Commit Task 3**

```bash
git add packages/client-contracts/src/chapter.ts \
  app/desktop/src/renderer/features/chapters/api/chapter-workspace-contract.ts \
  app/desktop/test/chapter-voice-contracts.test.mjs
git commit -m "refactor(desktop): consume workspace preview media id"
```

---

### Task 4: Remove stale preview contract residue and verify the PR

**Files:**
- Verify/modify only if stale references remain in the feature scope above.
- Update: PR #371 description with final contract and verification evidence.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: one consistent Chapter Workspace media identity boundary with no `previewImageUrl` or `visual_beats.preview_asset_id` usage in this flow.

- [ ] **Step 1: Search for stale Chapter Workspace preview references**

Run from repository root:

```bash
git grep -n "previewImageUrl\|preview_image_url\|preview_asset_id" -- \
  app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard \
  app/backend-service/src/main/resources/mybatis/ChapterWorkspaceMapper.xml \
  app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard \
  packages/client-contracts/src/chapter.ts \
  app/desktop/src/renderer/features/chapters
```

Expected for the Chapter Workspace flow: no `previewImageUrl`, no `preview_image_url`, and no `preview_asset_id`. A migration `DROP COLUMN preview_asset_id` outside this scoped search remains intentional.

- [ ] **Step 2: Run repository documentation drift check and classify baseline failures**

Run:

```bash
python scripts/check-docs-drift.py
```

Expected for this feature: the new spec/plan do not introduce forbidden current-state text. If the check still reports the pre-existing missing `V9__visual_beat_preview_media.sql` expectation after PR #370 folded/deleted V9, record that as an independent baseline cleanup issue; do not recreate V9 as part of this preview contract fix.

- [ ] **Step 3: Run full CI-equivalent verification**

Run:

```bash
cd app/backend-service && ./mvnw --batch-mode --no-transfer-progress verify
cd ../desktop && npm run check
```

Expected feature-local result: Desktop check passes and backend production code compiles. Full Backend verify may remain blocked by independent post-#370 stale test constants (`STORY_ANALYZE`, `HYBRID_LOCAL_I2V`) until that baseline cleanup is fixed; report those separately and do not conflate them with this preview-media change.

- [ ] **Step 4: Review the final PR diff**

Confirm the diff contains only:

```text
Chapter Workspace SQL/model/API identity cleanup
shared/Desktop contract cleanup
focused regression tests
approved spec + implementation plan
```

and does not add a replacement preview URL mechanism.

- [ ] **Step 5: Update PR #371 description with evidence**

Document:

- root cause: stale `vb.preview_asset_id` in `ChapterWorkspaceMapper.previewScenes()`
- canonical field: `preview_media_asset_id`
- API contract: `previewMediaAssetId`
- preview behavior: existing Storyboard/ProjectStorage resolver remains unchanged
- exact test/build results and any unrelated baseline blockers

- [ ] **Step 6: Final commit only if verification edits were required**

```bash
git add <only-files-changed-during-verification>
git commit -m "test(storyboard): cover workspace preview media contract"
```
