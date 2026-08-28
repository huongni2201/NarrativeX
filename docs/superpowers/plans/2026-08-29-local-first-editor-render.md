# Local-First Editor and Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the NarrativeX MVP edit-to-render flow by reading the current storyboard and narration directly, using generated local preview media as the default production source, allowing safe Editor overrides, and rendering through the existing local FFmpeg pipeline without requiring a MediaPlan.

**Architecture:** The current storyboard revision is the production timeline source. Effective beat media resolves as manual `production_beat_media_selections` override first, then `visual_beats.preview_media_asset_id`, otherwise missing. Narration and exact Visual Beat audio offsets remain the master clock; MediaPlan infrastructure stays in the repository for compatibility but no longer gates Editor visibility or local render admission.

**Tech Stack:** Java 25 · Spring Boot 4.1 · MyBatis/PostgreSQL · JUnit 5/AssertJ/Testcontainers · Electron 43 · React 19 · TypeScript 7 · Node test runner · FFmpeg/FFprobe

**Spec:** `docs/superpowers/specs/2026-08-29-local-first-editor-render-design.md`

## Global Constraints

- Do not create a new database table for this flow.
- `visual_beats.preview_media_asset_id` is the generated/default media source.
- `production_beat_media_selections` remains the explicit Editor override layer.
- Effective media precedence is manual override -> READY preview media -> missing.
- Narration is the master clock; final render requires exact contiguous Visual Beat timing from 0 to narration duration.
- Do not allow manual duration/retiming edits in this MVP.
- LOCAL_ONLY IMAGE/VIDEO media is valid for LOCAL_DEVICE rendering.
- MediaPlan-related tables/classes remain for compatibility but must not be required to load/edit/render the local-first timeline.
- Reuse the existing local FFmpeg renderer, journal, preflight, and artifact registration pipeline.
- Preserve existing Editor media mutation retry/concurrency handling.
- Every behavior change follows red-green-refactor and finishes with focused plus regression verification.

---

## File Map

### Backend timeline source

- Modify `app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml`
  - read current storyboard beats directly;
  - resolve effective media as selection -> preview asset;
  - compute chapter beat/ready counts from storyboard, not MediaPlan;
  - keep legacy media-plan fields nullable/compatibility-only.
- Create `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineLocalFirstIntegrationTest.java`
  - lock PostgreSQL source, precedence, reset, local-media metadata, and no-MediaPlan behavior.

### Backend readiness / render snapshot

- Modify `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCase.java`
  - separate inspectable preview timing from exact final-render timing;
  - remove MediaPlan readiness gates;
  - require exact alignment for `readyForRender`.
- Modify `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCaseTest.java`
  - local-first positive and negative readiness contracts.
- Modify `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineAlignedTimingTest.java` if existing aligned-clock expectations need MediaPlan-independent fixtures.
- Modify `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCaseTest.java`
  - prove LOCAL_DEVICE render job/snapshot creation succeeds from a local-first timeline with null MediaPlan fields.

### Editor mutation + presentation

- Modify `app/desktop/src/renderer/features/editor/EditorScreen.tsx`
  - expose local-first status and manual camera/trim handlers;
  - keep duration immutable.
- Modify `app/desktop/src/renderer/features/editor/components/EditorInspectorPanel.tsx`
  - generated/default vs override source state;
  - IMAGE/video control gating;
  - camera movement override UI;
  - trim-start UI for video only.
- Modify `app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx`
  - show missing media and incomplete timing without hiding beats.
- Modify `app/desktop/src/renderer/features/editor/beat-presentation.ts` if present; otherwise create it to centralize `READY / MISSING_MEDIA / TIMING_INCOMPLETE` presentation state.
- Modify/create corresponding Node tests under `app/desktop/test/`.

### Render UI

- Modify `app/desktop/src/renderer/features/production/screens/RenderScreen.tsx`
  - show concrete blockers;
  - disable render until backend readiness and local preflight allow it;
  - continue using the current `productionApi.startRender()` path.
- Create/modify `app/desktop/src/renderer/features/production/render-readiness.ts`
  - pure blocker derivation for deterministic UI tests.
- Create/modify `app/desktop/test/render-readiness.test.mjs`.

### Renderer regression

- Modify only if required by tests:
  - `app/desktop/src/main/rendering/render-manifest.ts`
  - `app/desktop/src/main/rendering/segment-renderer.ts`
- Extend existing renderer tests to prove null MediaPlan metadata is irrelevant and LOCAL_ONLY generated images render with exact narration spans.

### Documentation

- Modify `documentation/workflows/STORY_TO_VIDEO.md`.
- Modify `documentation/TRACEABILITY.md`.
- Optionally annotate MediaPlan as compatibility/legacy production planning in architecture docs; do not delete it in this change.

---

### Task 1: Make the production timeline read the current storyboard without a MediaPlan

**Files:**
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineLocalFirstIntegrationTest.java`
- Modify: `app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml`

**Interfaces:**
- Consumes: current ACTIVE/DRAFT story version; `chapters.current_storyboard_revision_id`; `scenes`; `visual_beats`; narration records; `media_assets`; optional `production_beat_media_selections`.
- Produces: existing `ProductionTimelineSourceRepository.ChapterSource` and `BeatSource` contracts, with `mediaPlanId/mediaPlanRevision` nullable and no longer required.

- [ ] **Step 1: Write the failing no-MediaPlan integration test**

Create a PostgreSQL fixture with:

```text
project -> ACTIVE story version -> chapter
chapter.current_storyboard_revision_id -> DRAFT/current storyboard revision
scene order_index=0
beat A: order_index=0, audio_start_ms=0,    audio_end_ms=4000
beat B: order_index=1, audio_start_ms=4000, audio_end_ms=10000
narration duration=10000 and valid size/checksum/storage metadata
READY LOCAL_ONLY image assets A/B
visual_beats.preview_media_asset_id -> image A/B
NO chapter_media_heads
NO generation_jobs
NO media_plans
NO media_beat_plans
NO media_generation_items
```

Core assertions:

```java
var chapters = mapper.findChapters(projectId, ownerId);
var beats = mapper.findBeats(projectId, ownerId);

assertThat(chapters).singleElement().satisfies(chapter -> {
  assertThat(chapter.getMediaPlanId()).isNull();
  assertThat(chapter.getMediaPlanRevision()).isNull();
  assertThat(chapter.getBeatCount()).isEqualTo(2);
  assertThat(chapter.getReadyBeatCount()).isEqualTo(2);
});

assertThat(beats)
    .extracting(
        ProductionTimelineBeatRow::getVisualBeatId,
        ProductionTimelineBeatRow::getAudioStartMs,
        ProductionTimelineBeatRow::getAudioEndMs,
        ProductionTimelineBeatRow::getMediaAssetId,
        ProductionTimelineBeatRow::getStorageMode)
    .containsExactly(
        tuple(firstBeatId, 0L, 4_000L, firstPreviewAssetId, "LOCAL_ONLY"),
        tuple(secondBeatId, 4_000L, 10_000L, secondPreviewAssetId, "LOCAL_ONLY"));
```

- [ ] **Step 2: Run the focused test and verify the current failure**

Run:

```powershell
cd app/backend-service
./mvnw.cmd -Dtest=ProductionTimelineLocalFirstIntegrationTest#returnsCurrentStoryboardPreviewMediaWithoutMediaPlan test
```

Expected: FAIL because `findBeats` currently inner-joins MediaPlan tables and `findChapters` counts `media_beat_plans` only.

- [ ] **Step 3: Rewrite `findBeats` around current storyboard rows**

Use a CTE shaped like:

```sql
WITH current_story AS (...),
current_beats AS (
  SELECT c.id AS chapter_id,
         c.order_index AS chapter_order_index,
         s.order_index AS scene_index,
         vb.order_index AS beat_index,
         vb.id AS visual_beat_id,
         vb.title,
         vb.visual_intent,
         COALESCE(vb.camera_movement, 'NONE') AS camera_movement,
         vb.audio_start_ms,
         vb.audio_end_ms,
         CASE
           WHEN vb.audio_start_ms IS NOT NULL AND vb.audio_end_ms > vb.audio_start_ms
           THEN vb.audio_end_ms - vb.audio_start_ms
           ELSE NULL
         END AS audio_duration_ms,
         vb.preview_media_asset_id
    FROM chapters c
    JOIN current_story cs ON cs.id = c.story_version_id
    JOIN scenes s
      ON s.chapter_id = c.id
     AND s.storyboard_revision_id = c.current_storyboard_revision_id
    JOIN visual_beats vb ON vb.scene_id = s.id
   WHERE c.deleted_at IS NULL
)
```

For compatibility columns emit:

```sql
NULL::uuid AS media_plan_id,
NULL::integer AS media_plan_revision,
'GENERATE_NEW' AS asset_strategy
```

- [ ] **Step 4: Resolve effective media with override precedence**

Keep the existing chosen-media lateral join but correlate it to `current_beats.visual_beat_id`.

Add a preview-media lateral join:

```sql
LEFT JOIN LATERAL (
  SELECT ma.id AS media_asset_id,
         ma.asset_type AS media_type,
         ma.storage_mode,
         ma.duration_ms AS source_duration_ms,
         ma.storage_key,
         ma.size_bytes,
         ma.sha256 AS checksum
    FROM media_assets ma
   WHERE ma.id = cb.preview_media_asset_id
     AND ma.account_id = #{ownerId}
     AND ma.status = 'READY'
     AND ma.deleted_at IS NULL
     AND ma.asset_type IN ('IMAGE', 'VIDEO')
     AND ma.size_bytes > 0
     AND ma.sha256 IS NOT NULL
   LIMIT 1
) preview ON TRUE
```

Select effective values with:

```sql
COALESCE(chosen.media_asset_id, preview.media_asset_id)
COALESCE(chosen.media_type, preview.media_type)
COALESCE(chosen.storage_mode, preview.storage_mode)
COALESCE(chosen.source_duration_ms, preview.source_duration_ms)
CASE WHEN chosen.media_asset_id IS NOT NULL THEN chosen.fit_mode ELSE 'TRIM' END
CASE WHEN chosen.media_asset_id IS NOT NULL THEN chosen.trim_start_ms ELSE 0 END
(chosen.media_asset_id IS NOT NULL)
COALESCE(chosen.storage_key, preview.storage_key)
COALESCE(chosen.size_bytes, preview.size_bytes)
COALESCE(chosen.checksum, preview.checksum)
```

- [ ] **Step 5: Rewrite chapter beat counts from current storyboard**

Replace plan-only counts with a lateral aggregate over the current storyboard revision:

```sql
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS beat_count,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1
               FROM production_beat_media_selections pbms
               JOIN media_assets ma ON ma.id = pbms.media_asset_id
              WHERE pbms.project_id = #{projectId,...}
                AND pbms.visual_beat_id = vb.id
                AND ma.status = 'READY'
                AND ma.deleted_at IS NULL
                AND ma.asset_type IN ('IMAGE', 'VIDEO')
                AND ma.size_bytes > 0
                AND ma.sha256 IS NOT NULL
           ) OR EXISTS (
             SELECT 1
               FROM media_assets ma
              WHERE ma.id = vb.preview_media_asset_id
                AND ma.account_id = #{ownerId}
                AND ma.status = 'READY'
                AND ma.deleted_at IS NULL
                AND ma.asset_type IN ('IMAGE', 'VIDEO')
                AND ma.size_bytes > 0
                AND ma.sha256 IS NOT NULL
           )
         )::int AS ready_beat_count
    FROM scenes s
    JOIN visual_beats vb ON vb.scene_id = s.id
   WHERE s.chapter_id = c.id
     AND s.storyboard_revision_id = c.current_storyboard_revision_id
) storyboard_counts ON TRUE
```

Use `storyboard_counts.beat_count` and `ready_beat_count` as authoritative MVP counts.

- [ ] **Step 6: Run the focused test green**

Run the Step 2 command.

Expected: PASS with two current storyboard beats, exact timing, local preview media, and null MediaPlan fields.

- [ ] **Step 7: Commit**

```powershell
git add app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineLocalFirstIntegrationTest.java
git commit -m "feat(backend): read local-first production timeline"
```

---

### Task 2: Lock manual override -> preview media precedence and reset semantics

**Files:**
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineLocalFirstIntegrationTest.java`
- Modify only if needed: `app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml`

**Interfaces:**
- Consumes: `production_beat_media_selections` and `visual_beats.preview_media_asset_id`.
- Produces: one effective media source per current Visual Beat; `mediaSelectionActive=true` only for explicit override.

- [ ] **Step 1: Add a failing precedence test**

Fixture: one beat has preview image A and explicit selection image/video B.

Assert:

```java
assertThat(row.getMediaAssetId()).isEqualTo(overrideAssetId);
assertThat(row.getMediaSelectionActive()).isTrue();
assertThat(row.getFitMode()).isEqualTo(expectedOverrideFit);
assertThat(row.getTrimStartMs()).isEqualTo(expectedTrim);
```

- [ ] **Step 2: Run the precedence test red/green**

```powershell
./mvnw.cmd -Dtest=ProductionTimelineLocalFirstIntegrationTest#manualSelectionOverridesPreviewMedia test
```

If Step 1 implementation already satisfies it, the test should pass immediately; otherwise fix only the SQL precedence expressions.

- [ ] **Step 3: Add reset behavior test**

Delete the `production_beat_media_selections` row through the repository/mapper used by `UpdateProductionBeatMediaUseCase.clear()` or direct fixture cleanup, then reload timeline rows and assert:

```java
assertThat(row.getMediaAssetId()).isEqualTo(previewAssetId);
assertThat(row.getMediaSelectionActive()).isFalse();
assertThat(row.getFitMode()).isEqualTo("TRIM");
assertThat(row.getTrimStartMs()).isZero();
```

- [ ] **Step 4: Add broken-override fallback rule test**

Create a selection pointing to an asset that is no longer READY/deleted, while preview media remains READY. Assert the effective source falls back to preview media rather than making the beat invisible.

- [ ] **Step 5: Run the integration test class**

```powershell
./mvnw.cmd -Dtest=ProductionTimelineLocalFirstIntegrationTest test
```

Expected: PASS for no-plan, override precedence, reset, and broken-override fallback.

- [ ] **Step 6: Commit**

```powershell
git add app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineLocalFirstIntegrationTest.java
git commit -m "test(backend): lock local media precedence"
```

---

### Task 3: Make exact narration alignment the render gate, not MediaPlan

**Files:**
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCaseTest.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCase.java`
- Modify if required: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineAlignedTimingTest.java`

**Interfaces:**
- Consumes: chapter narration metadata and local-first `BeatSource` rows with nullable MediaPlan fields.
- Produces: inspectable `ProductionTimelineView`, exact global beat spans, and `readyForRender` independent of MediaPlan.

- [ ] **Step 1: Replace the positive fixture with a no-MediaPlan local-first contract**

Add helper fixtures whose `mediaPlanId/mediaPlanRevision` are null and whose beats use exact offsets:

```text
chapter duration: 10000
beat 1: start=0,    end=4000, READY LOCAL_ONLY IMAGE
beat 2: start=4000, end=10000, READY LOCAL_ONLY IMAGE
```

Assert:

```java
assertThat(timeline.readyForRender()).isTrue();
assertThat(timeline.chapters().getFirst().readyForRender()).isTrue();
assertThat(timeline.beats())
    .extracting(beat -> List.of(beat.startMs(), beat.endMs(), beat.assetReady()))
    .containsExactly(
        List.of(0L, 4_000L, true),
        List.of(4_000L, 10_000L, true));
```

- [ ] **Step 2: Run and verify failure caused by current plan gate**

```powershell
cd app/backend-service
./mvnw.cmd -Dtest=GetProductionTimelineUseCaseTest#admitsExactLocalFirstTimelineWithoutMediaPlan test
```

Expected: FAIL because current `planReady` requires non-null MediaPlan id/revision.

- [ ] **Step 3: Split preview timing from final readiness**

Keep `planBeatTiming(...)` for inspectable timeline construction, but compute an explicit exact-clock flag before admission:

```java
boolean exactTimingReady = hasCompleteAlignedClock(chapterBeats, chapterDurationMs);
```

Build beats as today so incomplete timelines remain visible.

- [ ] **Step 4: Replace MediaPlan readiness logic**

Remove `planMatches` / `planReady` as admission requirements.

Use:

```java
boolean storyboardReady =
    !chapterBeats.isEmpty()
        && chapter.beatCount() > 0
        && chapterBeats.size() == chapter.beatCount()
        && exactTimingReady;

boolean assetsReady =
    storyboardReady
        && plannedBeats.size() == chapter.beatCount()
        && plannedBeats.stream().allMatch(ProductionTimelineView.Beat::assetReady);

boolean chapterReady = audioReady && assetsReady;
```

- [ ] **Step 5: Add negative exact-clock tests**

Add distinct tests for:

```text
first beat starts at 100 instead of 0
internal gap: beat1 ends 4000, beat2 starts 4500
overlap: beat1 ends 5000, beat2 starts 4000
last beat ends 9500 while narration is 10000
null boundary on one beat
```

For each, assert beats remain inspectable but `chapter.readyForRender=false` and project `readyForRender=false`.

- [ ] **Step 6: Add missing-media and narration-negative tests**

Lock these conditions:

```text
READY exact timing + one missing media -> false
READY beats + missing narration checksum -> false
READY beats + narration duration <= 0 -> false
```

- [ ] **Step 7: Run timeline test suite**

```powershell
./mvnw.cmd -Dtest=GetProductionTimelineUseCaseTest,GetProductionTimelineAlignedTimingTest,ProductionTimelineLocalFirstIntegrationTest test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCase.java app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCaseTest.java app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineAlignedTimingTest.java
git commit -m "feat(backend): admit exact local-first render timelines"
```

---

### Task 4: Prove render job/snapshot creation no longer depends on MediaPlan

**Files:**
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCaseTest.java`
- Modify only if regression appears: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCase.java`
- Modify only if snapshot SQL assumes MediaPlan: relevant `ProjectRenderInputSnapshotRepository` mapper/test files discovered during execution.

**Interfaces:**
- Consumes: `ProductionTimelineView.readyForRender=true` with null chapter MediaPlan fields and LOCAL_ONLY beat media.
- Produces: queued `RENDER_PROJECT` job, immutable input snapshot, LOCAL_DEVICE stage attempt/outbox event.

- [ ] **Step 1: Add a local-first render creation test**

Fixture a timeline:

```text
executionTarget=LOCAL_DEVICE
eligible paired device
chapter.mediaPlanId=null
chapter.mediaPlanRevision=null
narration valid
beats exact + LOCAL_ONLY READY image assets
readyForRender=true
```

Call `useCase.execute(command)` and verify:

```java
assertThat(job.getStatus()).isEqualTo(JobStatus.QUEUED);
verify(projectRenderInputSnapshotRepository)
    .create(eq(job.getId()), eq(timeline), eq("1080p"), eq("mp4"), eq(LOCAL_DEVICE), eq(deviceId));
verify(generationOutboxRepository).enqueue(job);
```

- [ ] **Step 2: Run focused test**

```powershell
./mvnw.cmd -Dtest=CreateProjectRenderUseCaseTest#createsLocalRenderSnapshotWithoutMediaPlan test
```

Expected: PASS unless a hidden MediaPlan assumption exists downstream.

- [ ] **Step 3: If snapshot persistence fails, write the failing persistence test before changing SQL**

Do not add synthetic MediaPlan values. Update snapshot persistence to store the nullable compatibility fields already present in the timeline, or stop requiring them if the snapshot schema does not need them.

- [ ] **Step 4: Lock LOCAL_ONLY vs CLOUD behavior**

Keep/extend tests proving:

```text
LOCAL_DEVICE + LOCAL_ONLY media -> allowed
CLOUD + LOCAL_ONLY media -> GenerationAdmissionDeniedException("CLOUD_RENDER_LOCAL_MEDIA")
```

- [ ] **Step 5: Run render-use-case tests**

```powershell
./mvnw.cmd -Dtest=CreateProjectRenderUseCaseTest,CreateAutoEditedProjectRenderUseCaseTest test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCaseTest.java app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCase.java
git commit -m "test(backend): render local-first snapshots without media plans"
```

---

### Task 5: Add deterministic Editor presentation states

**Files:**
- Create or modify: `app/desktop/src/renderer/features/editor/beat-presentation.ts`
- Create or modify: `app/desktop/test/beat-presentation.test.mjs`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPlaybackSurface.tsx` only if status messaging is owned there.

**Interfaces:**
- Consumes: `DesktopTimelineBeat` plus chapter/timeline readiness context.
- Produces:

```ts
export type BeatPresentationState = "READY" | "MISSING_MEDIA" | "TIMING_INCOMPLETE";

export interface BeatPresentation {
  state: BeatPresentationState;
  label: string;
  renderBlocked: boolean;
}
```

- [ ] **Step 1: Write the pure helper tests**

Cover:

```text
assetReady=true + positive exact span -> READY
assetReady=false -> MISSING_MEDIA
non-positive span or timingIncomplete flag -> TIMING_INCOMPLETE
```

Expected labels:

```text
READY -> "Ready"
MISSING_MEDIA -> "Missing media"
TIMING_INCOMPLETE -> "Timing incomplete"
```

- [ ] **Step 2: Run tests red**

```powershell
cd app/desktop
npm test -- beat-presentation
```

Expected: FAIL if helper does not yet exist.

- [ ] **Step 3: Implement the helper with no React dependency**

Example API:

```ts
export function describeBeatPresentation(
  beat: Pick<DesktopTimelineBeat, "assetReady" | "startMs" | "endMs">,
  timingExact: boolean,
): BeatPresentation {
  if (!timingExact || beat.endMs <= beat.startMs) {
    return { state: "TIMING_INCOMPLETE", label: "Timing incomplete", renderBlocked: true };
  }
  if (!beat.assetReady) {
    return { state: "MISSING_MEDIA", label: "Missing media", renderBlocked: true };
  }
  return { state: "READY", label: "Ready", renderBlocked: false };
}
```

- [ ] **Step 4: Wire timeline beat visuals to presentation state**

`EditorMultiTrackTimeline` must keep every beat clickable and sized from its current span. Use status only for badge/opacity/border/copy; do not remove incomplete beats.

- [ ] **Step 5: Run Editor tests**

```powershell
npm test -- beat-presentation editor-timeline preview-playback
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/desktop/src/renderer/features/editor/beat-presentation.ts app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx app/desktop/test/beat-presentation.test.mjs
git commit -m "feat(desktop): show local-first editor beat states"
```

---

### Task 6: Complete safe manual edit controls without retiming narration

**Files:**
- Modify: `app/desktop/src/renderer/features/editor/EditorScreen.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorInspectorPanel.tsx`
- Modify: `app/desktop/src/renderer/features/editor/queries/editor-media.mutations.ts`
- Modify if contract lacks fields: `packages/client-contracts/...` exact contract file discovered during execution.
- Modify/create corresponding tests under `app/desktop/test/`.

**Interfaces:**
- Existing backend media endpoint remains:

```text
PUT /api/v1/projects/{projectId}/production/beats/{visualBeatId}/media
DELETE /api/v1/projects/{projectId}/production/beats/{visualBeatId}/media
```

- Existing `UpdateBeatMediaInput` persists media asset + fit mode + trim start.
- Camera movement stays a render override generated by Auto Edit/manual Editor state; it must not mutate narration timing.

- [ ] **Step 1: Add Inspector behavior tests for IMAGE vs VIDEO**

Lock:

```text
IMAGE: duration read-only; trim start unavailable; fit buttons disabled/not applicable
VIDEO: duration read-only; fit buttons enabled; trim start editable
manual override source: Reset button visible
default preview source: Reset button hidden
```

- [ ] **Step 2: Add a video trim mutation path**

Expose an `onUpdateTrimStart(trimStartMs: number)` handler from `EditorScreen`.

Use the current selected beat asset and current fit mode:

```ts
mediaMutations.updateBeatMedia.mutateAsync({
  beat,
  mediaAssetId: beat.mediaAssetId,
  fitMode: beat.fitMode,
  trimStartMs,
});
```

If the existing mutation hook names differ, use its current primitive rather than adding another API path.

- [ ] **Step 3: Validate trim locally before request**

Client validation:

```text
trimStartMs >= 0
IMAGE => forced 0
VIDEO with known sourceDurationMs => trimStartMs < sourceDurationMs
```

Backend remains authoritative and already validates fit/trim combinations.

- [ ] **Step 4: Add manual camera selection state**

Supported values must match renderer support:

```ts
const CAMERA_MOVEMENTS = [
  "NONE", "PAN", "TILT", "PUSH_IN", "PULL_OUT",
  "TRACK", "ZOOM_IN", "ZOOM_OUT", "PARALLAX",
] as const;
```

Store this as Editor/render override state, not by modifying beat duration. Feed it into the render overrides used by `createAutoEditPlan` or a merged manual-overrides layer.

- [ ] **Step 5: Keep narration duration immutable in UI**

The existing duration input remains `readOnly`. Do not add timeline drag handles or duration mutation endpoints.

- [ ] **Step 6: Run Editor mutation/presentation tests**

```powershell
npm test -- editor-media inspector auto-edit-planner
```

Then:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add app/desktop/src/renderer/features/editor app/desktop/test packages/client-contracts
git commit -m "feat(desktop): complete safe beat editing controls"
```

---

### Task 7: Make RenderScreen explain readiness blockers and render local-first projects

**Files:**
- Create: `app/desktop/src/renderer/features/production/render-readiness.ts`
- Create: `app/desktop/test/render-readiness.test.mjs`
- Modify: `app/desktop/src/renderer/features/production/screens/RenderScreen.tsx`
- Modify only if needed: `app/desktop/src/renderer/features/production/api/production.api.ts`

**Interfaces:**
- Consumes: `DesktopTimeline`, local preflight result, active render job.
- Produces:

```ts
export interface RenderReadiness {
  ready: boolean;
  blockers: string[];
}
```

- [ ] **Step 1: Write readiness helper tests**

Cover at minimum:

```text
null timeline -> "Timeline not loaded"
chapter not ready + no narration asset -> narration blocker
beat.assetReady=false -> "Missing media: N beat(s)"
timeline.readyForRender=false with all media present -> "Timing incomplete"
ready timeline -> no blockers
preflight blockers are appended after backend readiness passes
```

- [ ] **Step 2: Run red**

```powershell
cd app/desktop
npm test -- render-readiness
```

- [ ] **Step 3: Implement pure blocker derivation**

Keep backend `timeline.readyForRender` authoritative. UI diagnosis should derive human-readable blockers from chapter/beat fields and never override a backend false to true.

- [ ] **Step 4: Update `RenderScreen` CTA behavior**

Button disabled when:

```ts
busy || !timeline || !readiness.ready
```

Render card should show blocker list before preflight instead of generic "Waiting for media".

- [ ] **Step 5: Keep the existing render execution path**

Do not bypass backend snapshots or call FFmpeg directly from renderer React code. Continue:

```text
productionApi.preflight(...)
productionApi.startRender(...)
useGenerationJob(...)
window.narrativex.localStorage.revealArtifact(...)
```

- [ ] **Step 6: Run production UI tests + typecheck**

```powershell
npm test -- render-readiness auto-edit-planner
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add app/desktop/src/renderer/features/production app/desktop/test/render-readiness.test.mjs
git commit -m "feat(desktop): explain local render readiness"
```

---

### Task 8: Verify local-first snapshots still satisfy the existing FFmpeg renderer

**Files:**
- Modify existing tests for:
  - `app/desktop/src/main/rendering/render-manifest.ts`
  - `app/desktop/src/main/rendering/segment-renderer.ts`
- Modify production renderer files only if a real incompatibility is reproduced.

**Interfaces:**
- Consumes: claimed render snapshot containing exact beat/global timing, LOCAL_ONLY local paths, media metadata, fit/trim/camera values.
- Produces: unchanged `LocalRenderManifest` and rendered MP4 segments.

- [ ] **Step 1: Add a manifest test with local-first image beats**

Fixture:

```text
2 chapters or 1 chapter
contiguous narration clock
2 LOCAL_ONLY IMAGE beats
null/absent MediaPlan concepts in the source fixture
exact global beat clock
valid checksum/size/localPath
```

Assert `buildLocalRenderManifest()` succeeds and preserves exact start/end/duration.

- [ ] **Step 2: Add camera movement segment-args regression cases**

For IMAGE beats, lock recognized values:

```text
NONE
PAN
TILT
PUSH_IN
PULL_OUT
TRACK
ZOOM_IN
ZOOM_OUT
PARALLAX
```

The test should assert generation does not fall through to unsupported behavior and duration remains narration-derived.

- [ ] **Step 3: Add video fit regression if Editor trim UI changed**

Cover `TRIM`, `LOOP`, `FREEZE_END`, `SPEED_ADJUST` with nonzero trim start where legal.

- [ ] **Step 4: Run renderer tests**

Use the repository's existing Node test command for rendering modules, then:

```powershell
npm run typecheck
```

Expected: PASS without production renderer changes in the normal case.

- [ ] **Step 5: Commit**

```powershell
git add app/desktop/src/main/rendering app/desktop/test
git commit -m "test(desktop): lock local-first ffmpeg render contract"
```

---

### Task 9: End-to-end API and Desktop flow verification

**Files:**
- Modify/add focused API integration tests only where current coverage does not already exercise the flow.
- No production code unless a test reproduces a real integration gap.

**Interfaces:**
- Verifies the full path:

```text
preview media attached to Visual Beat
-> production timeline returns effective media
-> Editor override/reset works
-> timeline becomes ready
-> local render job created
-> local executor can claim/materialize snapshot
```

- [ ] **Step 1: Extend storyboard API integration coverage**

After `PUT .../preview-media`, fetch the production timeline and assert the same media asset becomes the effective beat source without creating a MediaPlan.

- [ ] **Step 2: Extend production API integration coverage**

With valid narration, exact timing, and preview media, assert:

```text
GET /production/timeline => readyForRender=true
POST /production/render with LOCAL_DEVICE => 202 + queued job
```

Use the existing paired-device test fixture instead of mocking around controller boundaries.

- [ ] **Step 3: Run focused backend integration tests**

```powershell
cd app/backend-service
./mvnw.cmd -Dtest=StoryboardApiIntegrationTest,ProductionRenderApiIntegrationTest,ProductionTimelineLocalFirstIntegrationTest test
```

If the production API test class has a different exact name, use the existing class that covers `ProductionRenderController`.

- [ ] **Step 4: Run full Desktop checks**

```powershell
cd app/desktop
npm test
npm run typecheck
```

- [ ] **Step 5: Run backend verification gate**

Use the repository's standard backend verify command from CI/README, not an ad-hoc reduced command. At minimum run Maven tests/format/static checks equivalent to the Backend verify workflow.

- [ ] **Step 6: Perform manual runtime smoke test**

Using a project with completed narration and generated images:

```text
1. Open Editor.
2. Confirm all generated images appear without generating a MediaPlan.
3. Play narration; visual preview follows beat boundaries.
4. Replace one image with another asset; confirm it persists.
5. Reset source; confirm generated preview image returns.
6. Change camera movement on one image.
7. If using video, test fit mode + trim start.
8. Confirm duration is not editable.
9. Open Render; verify no blockers.
10. Start 1080p local render.
11. Confirm progress reaches COMPLETED.
12. Open output and verify audio/video sync at chapter and beat boundaries.
```

- [ ] **Step 7: Commit any integration-only test additions**

```powershell
git add app/backend-service/src/test app/desktop/test
git commit -m "test: verify local-first edit to render flow"
```

---

### Task 10: Update workflow documentation and mark MediaPlan off the MVP critical path

**Files:**
- Modify: `documentation/workflows/STORY_TO_VIDEO.md`
- Modify: `documentation/TRACEABILITY.md`
- Modify if necessary: `documentation/architecture/DATA_FLOW.md`
- Modify if necessary: `documentation/architecture/SERVICE_BOUNDARIES.md`

**Interfaces:**
- Produces: documentation matching the implemented source-of-truth and local render flow.

- [ ] **Step 1: Update STORY_TO_VIDEO**

Document the concrete pipeline:

```text
Analyze -> narration/alignment -> Visual Beats -> generated preview media
-> Editor current storyboard timeline -> optional manual overrides
-> exact timing/media readiness -> local render snapshot -> FFmpeg -> artifact
```

State that MediaPlan is not required for this MVP route.

- [ ] **Step 2: Update traceability**

Add verified requirements/coverage for:

```text
current storyboard production timeline
preview media default source
manual override precedence/reset
exact narration render gate
LOCAL_ONLY render admission
Editor -> local FFmpeg render completion
```

- [ ] **Step 3: Update architecture docs only where they currently claim MediaPlan is mandatory**

Do not perform a broad documentation rewrite.

- [ ] **Step 4: Run docs/reference checks if repository has them**

Then inspect `git diff --check`.

- [ ] **Step 5: Commit**

```powershell
git add documentation
git commit -m "docs: document local-first editor render flow"
```

---

### Task 11: Final regression verification and cleanup review

**Files:**
- No planned production changes. Any change must be justified by a reproduced failure.

**Interfaces:**
- Produces: merge-ready branch with no hidden MediaPlan requirement in the MVP edit/render path.

- [ ] **Step 1: Search for remaining critical-path MediaPlan assumptions**

Search production timeline, Editor, RenderScreen, render admission, and snapshot creation for:

```text
mediaPlanId
mediaPlanRevision
chapter_media_heads
media_beat_plans
media_generation_items
```

Classify each occurrence:

```text
compatibility/read-only -> keep
unrelated generation pipeline -> keep
MVP timeline/render admission gate -> remove/fix
```

- [ ] **Step 2: Verify no accidental scope creep**

Confirm no implementation added:

```text
new production table
manual duration editing
new FFmpeg engine
cloud support for LOCAL_ONLY media
MediaPlan deletion/migration
```

- [ ] **Step 3: Run repository gates**

Run the same checks as CI for:

```text
Repository gates
Backend verify
Desktop check
AI worker checks if shared contracts/docs changed
```

- [ ] **Step 4: Inspect final diff**

Check:

```powershell
git status
git diff --check
git diff main...HEAD
```

Verify generated/local media path is not accidentally routed back through R2.

- [ ] **Step 5: Final commit only if verification required cleanup**

Use a narrow message matching the actual cleanup, e.g.:

```powershell
git commit -m "fix: close local-first render integration gaps"
```

- [ ] **Step 6: Push and open PR**

PR summary should explicitly state:

```text
- current storyboard replaces MediaPlan as MVP production timeline source
- generated preview media becomes default render media
- manual selections remain overrides
- exact narration timing gates final render
- existing local FFmpeg pipeline is reused
- MediaPlan infrastructure is retained but removed from the critical MVP path
```

Include the focused test commands and full CI/gate results in the PR body.
