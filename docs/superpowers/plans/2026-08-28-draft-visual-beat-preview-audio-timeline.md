# Draft Visual Beat Preview and Audio Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show narration-aligned Visual Beat clips and meaningful preview cards immediately after analysis, even before a media plan or image exists, while making narration audio the authoritative playback clock.

**Architecture:** Extend the existing backend production-timeline read model with a draft source: use the current completed media-plan snapshot when one exists, otherwise read the current storyboard revision's `Scene` and `VisualBeat` rows. Keep final-render admission unchanged—draft beats remain inspectable but never render-ready without a valid media plan and ready assets. In Desktop, retain `EditorPlaybackSurface` as playback-state owner, but feed its playhead from the selected chapter's real `<audio>` clock; the timer remains only a no-audio fallback.

**Tech Stack:** Java 25 · Spring Boot 4.1 · MyBatis/PostgreSQL · JUnit 5/AssertJ/Testcontainers · Electron 43 · React 19 · TypeScript 7 · Node test runner

**Spec:** In-chat bounded design approved on 2026-08-28; no separate architecture spec is required.

## Global Constraints

- PostgreSQL remains authoritative for storyboard, timing, media selections, and production-timeline reads.
- Do not create a `MediaPlan`, reserve cost, or enqueue provider work merely to make draft beats visible.
- A valid current media-plan snapshot always takes precedence over storyboard fallback rows.
- Draft beats are inspectable and editable but do not make `readyForRender` true.
- Narration remains the master clock; timeline clips use explicit global `startMs` and `endMs`.
- Desktop renderer receives URLs and stable IDs only; it does not gain Node.js, filesystem, or process access.
- Existing user changes in the worktree must be preserved.
- All behavior changes follow red-green-refactor, then Desktop runtime verification.

## File Map

- Create `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineDraftSourceIntegrationTest.java`: PostgreSQL contract proving current storyboard beats are returned without a media plan and are superseded by a current plan.
- Modify `app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml`: produce planned or draft beat rows and draft chapter counts.
- Modify `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCaseTest.java`: lock draft timing and render-admission semantics at the application layer.
- Modify `app/desktop/src/renderer/features/editor/preview-playback.ts`: add pure narration-clock conversion and fallback-clock helpers.
- Modify `app/desktop/test/preview-playback.test.mjs`: cover audio-authoritative playhead, clamping, fallback advancement, and end-of-scope behavior.
- Modify `app/desktop/src/renderer/features/editor/components/EditorPlaybackSurface.tsx`: stop the periodic clock when narration is active and accept playhead/error events from the audio element.
- Modify `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`: drive playhead from real audio time, surface playback failures, and render the no-image card.
- Create `app/desktop/src/renderer/features/editor/beat-presentation.ts`: pure view-model helpers for pending-media preview and timeline state.
- Create `app/desktop/test/beat-presentation.test.mjs`: test no-image copy, timing label, and ready/pending state.
- Modify `app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx`: visually distinguish pending beats while preserving their exact span and click/seek behavior.
- Modify `documentation/workflows/STORY_TO_VIDEO.md`: document draft storyboard fallback and audio-master preview behavior.
- Modify `documentation/TRACEABILITY.md`: record the verified draft-preview/timeline capability.

---

### Task 1: Return current storyboard Visual Beats when no media plan exists

**Files:**

- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineDraftSourceIntegrationTest.java`
- Modify: `app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml:172`

**Interfaces:**

- Consumes: `ProductionTimelineMapper.findBeats(UUID projectId, String ownerId)` and the current `chapters.current_storyboard_revision_id` pointer.
- Produces: existing `ProductionTimelineBeatRow` values with nullable `mediaPlanId/mediaPlanRevision/mediaAssetId`, using `visual_beats.audio_start_ms/audio_end_ms` for draft timing.

- [ ] **Step 1: Write the failing PostgreSQL integration test**

Create a Spring Boot integration test extending `PostgreSqlIntegrationTestSupport`. Insert one owned project, one active story version, one chapter, one current `DRAFT` storyboard revision, one scene, and two Visual Beats without creating `chapter_media_heads`, `generation_jobs`, `media_plans`, or `media_beat_plans`.

The core assertion must be:

```java
@Test
void returnsCurrentStoryboardBeatsBeforeAnyMediaPlanExists() {
  DraftFixture fixture = insertDraftFixture("draft-timeline-owner");

  var rows = mapper.findBeats(fixture.projectId(), "draft-timeline-owner");

  assertThat(rows)
      .extracting(
          ProductionTimelineBeatRow::getVisualBeatId,
          ProductionTimelineBeatRow::getSceneIndex,
          ProductionTimelineBeatRow::getBeatIndex,
          ProductionTimelineBeatRow::getAudioStartMs,
          ProductionTimelineBeatRow::getAudioEndMs,
          ProductionTimelineBeatRow::getMediaPlanId,
          ProductionTimelineBeatRow::getMediaAssetId)
      .containsExactly(
          tuple(fixture.firstBeatId(), 0, 0, 0L, 4_000L, null, null),
          tuple(fixture.secondBeatId(), 0, 1, 4_000L, 10_000L, null, null));
}
```

Use `JdbcTemplate` inserts with unique UUIDv7-backed rows and set:

```text
scene.order_index = 0
scene.duration_seconds = 10
first beat:  order_index=0, audio_start_ms=0,    audio_end_ms=4000
second beat: order_index=1, audio_start_ms=4000, audio_end_ms=10000
chapter.current_storyboard_revision_id = inserted revision
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```powershell
cd app/backend-service
./mvnw.cmd -Dtest=ProductionTimelineDraftSourceIntegrationTest#returnsCurrentStoryboardBeatsBeforeAnyMediaPlanExists test
```

Expected: FAIL because `findBeats` currently inner-joins `chapter_media_heads`, `generation_jobs`, `media_plans`, and `media_beat_plans`, producing zero rows.

- [ ] **Step 3: Implement the planned-or-draft beat source CTE**

Rewrite `findBeats` around these responsibilities:

```sql
WITH current_story AS (...),
chapter_context AS (
  SELECT c.id AS chapter_id,
         c.order_index AS chapter_order_index,
         c.current_storyboard_revision_id,
         mp.id AS media_plan_id,
         mp.revision AS media_plan_revision
    FROM chapters c
    JOIN current_story cs ON cs.id = c.story_version_id
    LEFT JOIN chapter_media_heads cmh ON cmh.chapter_id = c.id
    LEFT JOIN generation_jobs gj
      ON gj.id = cmh.generation_job_id AND gj.status = 'COMPLETED'
    LEFT JOIN media_plans mp
      ON mp.id = gj.media_plan_id
     AND mp.revision = gj.media_plan_revision
     AND mp.chapter_id = c.id
     AND mp.chapter_row_version = c.row_version
     AND mp.source_hash = c.source_hash
     AND mp.storyboard_revision_id = c.current_storyboard_revision_id
   WHERE c.deleted_at IS NULL
),
beat_sources AS (
  SELECT cc.chapter_id,
         cc.chapter_order_index,
         cc.media_plan_id,
         cc.media_plan_revision,
         mbp.scene_index,
         mbp.beat_index,
         mbp.visual_beat_id,
         COALESCE(vb.title, CONCAT('Beat ', mbp.beat_index + 1)) AS title,
         mbp.visual_intent,
         COALESCE(mbp.camera_movement, 'NONE') AS camera_movement,
         mbp.asset_strategy,
         mbp.audio_start_ms,
         mbp.audio_end_ms,
         mbp.audio_duration_ms
    FROM chapter_context cc
    JOIN media_beat_plans mbp ON mbp.media_plan_id = cc.media_plan_id
    LEFT JOIN visual_beats vb ON vb.id = mbp.visual_beat_id

  UNION ALL

  SELECT cc.chapter_id,
         cc.chapter_order_index,
         NULL::uuid AS media_plan_id,
         NULL::integer AS media_plan_revision,
         s.order_index AS scene_index,
         vb.order_index AS beat_index,
         vb.id AS visual_beat_id,
         vb.title,
         vb.visual_intent,
         COALESCE(vb.camera_movement, 'NONE') AS camera_movement,
         'GENERATE_NEW' AS asset_strategy,
         vb.audio_start_ms,
         vb.audio_end_ms,
         CASE
           WHEN vb.audio_start_ms IS NOT NULL AND vb.audio_end_ms > vb.audio_start_ms
             THEN vb.audio_end_ms - vb.audio_start_ms
           ELSE NULL
         END AS audio_duration_ms
    FROM chapter_context cc
    JOIN scenes s
      ON s.chapter_id = cc.chapter_id
     AND s.storyboard_revision_id = cc.current_storyboard_revision_id
    JOIN visual_beats vb ON vb.scene_id = s.id
)
```

At this red-green stage, leave the draft branch unguarded so the first no-plan contract becomes green; the precedence guard is introduced only after its failing test in Step 5. Keep the existing chosen-media lateral join, but correlate it with `beat_sources.visual_beat_id` so explicit uploads work before media planning. Keep the generated-media lateral join correlated by both `media_plan_id` and `visual_beat_id`; it naturally yields no row for draft beats. Preserve ordering by chapter, scene, and beat.

- [ ] **Step 4: Run the focused integration test**

Run the command from Step 2.

Expected: PASS; both rows retain their Visual Beat IDs and exact audio spans while plan/media fields remain null.

- [ ] **Step 5: Add precedence coverage for a current media plan**

Add `usesCurrentMediaPlanRowsInsteadOfDuplicatingStoryboardFallback()` to the same test class. Insert a valid completed generation head/plan with two `media_beat_plans` for the same storyboard and assert exactly two rows—not four—and non-null `mediaPlanId/mediaPlanRevision`.

- [ ] **Step 6: Run the precedence test red, add the exact CTE guard, then run green**

Run:

```powershell
./mvnw.cmd -Dtest=ProductionTimelineDraftSourceIntegrationTest test
```

Expected before the guard: FAIL with duplicate planned and draft rows. Add `WHERE cc.media_plan_id IS NULL` to the draft half of `beat_sources`, rerun, and expect PASS with only planned rows.

- [ ] **Step 7: Commit the repository behavior**

```powershell
git add app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineDraftSourceIntegrationTest.java
git commit -m "feat(backend): expose draft storyboard beats on production timeline"
```

---

### Task 2: Preserve draft timing while keeping render admission closed

**Files:**

- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineDraftSourceIntegrationTest.java`
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCaseTest.java`
- Modify: `app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml:92`

**Interfaces:**

- Consumes: nullable-plan `BeatSource` rows created in Task 1.
- Produces: `ProductionTimelineView` with visible draft beats, exact aligned spans where complete, `chapter.readyForRender=false`, and `timeline.readyForRender=false`.

- [ ] **Step 1: Extend the integration test with failing draft chapter-count assertions**

In `returnsCurrentStoryboardBeatsBeforeAnyMediaPlanExists()`, call `mapper.findChapters(...)` and assert:

```java
assertThat(mapper.findChapters(fixture.projectId(), "draft-timeline-owner"))
    .singleElement()
    .satisfies(chapter -> {
      assertThat(chapter.getMediaPlanId()).isNull();
      assertThat(chapter.getBeatCount()).isEqualTo(2);
      assertThat(chapter.getReadyBeatCount()).isZero();
    });
```

- [ ] **Step 2: Run the integration test and verify the count failure**

Run:

```powershell
cd app/backend-service
./mvnw.cmd -Dtest=ProductionTimelineDraftSourceIntegrationTest#returnsCurrentStoryboardBeatsBeforeAnyMediaPlanExists test
```

Expected: FAIL because `findChapters` currently obtains `beat_count` only from `media_beat_plans`.

- [ ] **Step 3: Add storyboard fallback counts to `findChapters`**

Add a lateral aggregate restricted to `c.current_storyboard_revision_id`:

```sql
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS beat_count,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1
               FROM production_beat_media_selections pbms
               JOIN media_assets ma ON ma.id = pbms.media_asset_id
              WHERE pbms.project_id = #{projectId,typeHandler=com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.UuidTypeHandler}
                AND pbms.visual_beat_id = vb.id
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
) storyboard_counts ON mp.id IS NULL
```

Select `COALESCE(plan_counts.beat_count, storyboard_counts.beat_count, 0)` and the corresponding ready count. The plan aggregate still wins when `mp.id` is non-null.

- [ ] **Step 4: Run the focused integration test green**

Run the Step 2 command.

Expected: PASS with `beatCount=2`, `readyBeatCount=0`, and no media plan.

- [ ] **Step 5: Add an application-layer contract test for draft beats**

Add `showsAlignedDraftBeatsButDoesNotAdmitRender()` using a `ChapterSource` with `mediaPlanId=null`, `mediaPlanRevision=null`, audio duration `10_000`, and two `BeatSource` rows with null plan/media fields and aligned spans `[0, 4_000]`, `[4_000, 10_000]`.

Assert:

```java
assertThat(timeline.beats())
    .extracting(beat -> List.of(beat.startMs(), beat.endMs(), beat.assetReady()))
    .containsExactly(List.of(0L, 4_000L, false), List.of(4_000L, 10_000L, false));
assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
assertThat(timeline.readyForRender()).isFalse();
```

This is a semantic regression test for the generic timing code; no production change is expected if Task 1 supplies correct rows.

- [ ] **Step 6: Run backend timeline tests**

Run:

```powershell
./mvnw.cmd -Dtest=GetProductionTimelineUseCaseTest,GetProductionTimelineAlignedTimingTest,ProductionTimelineDraftSourceIntegrationTest test
```

Expected: PASS, including existing media-plan timing/render-ready cases.

- [ ] **Step 7: Commit draft timing and count semantics**

```powershell
git add app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCaseTest.java app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineDraftSourceIntegrationTest.java
git commit -m "test(backend): lock draft beat timing and render admission"
```

---

### Task 3: Make narration audio the Desktop playhead authority

**Files:**

- Modify: `app/desktop/test/preview-playback.test.mjs`
- Modify: `app/desktop/src/renderer/features/editor/preview-playback.ts`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPlaybackSurface.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`

**Interfaces:**

- Produces: `narrationPlayheadMs(currentTimeSeconds, chapterStartMs, chapterEndMs): number`.
- Produces: `advanceFallbackPlayhead(currentMs, elapsedMs, scopeStartMs, scopeEndMs): number`.
- `EditorPreviewViewport` emits `onNarrationClock(globalMs)`, `onNarrationEnded(globalMs)`, and `onNarrationError(message)`.
- `EditorPlaybackSurface` keeps `playheadMs/playing` authoritative for timeline and selection, but consumes audio clock events whenever `narrationUrl` exists.

- [ ] **Step 1: Write failing pure clock tests**

Add:

```javascript
test("narration audio time maps to the global project clock", () => {
  assert.equal(narrationPlayheadMs(2.5, 10_000, 20_000), 12_500);
  assert.equal(narrationPlayheadMs(12, 10_000, 20_000), 20_000);
});

test("fallback clock advances only inside the selected scope", () => {
  assert.equal(advanceFallbackPlayhead(1_000, 250, 0, 2_000), 1_250);
  assert.equal(advanceFallbackPlayhead(1_900, 250, 0, 2_000), 2_000);
});
```

- [ ] **Step 2: Run the clock tests red**

Run:

```powershell
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test test/preview-playback.test.mjs
```

Expected: FAIL because both named exports are missing.

- [ ] **Step 3: Implement the minimal pure helpers**

Add:

```typescript
export function narrationPlayheadMs(
  currentTimeSeconds: number,
  chapterStartMs: number,
  chapterEndMs: number,
): number {
  const localMs = Number.isFinite(currentTimeSeconds)
    ? Math.round(Math.max(0, currentTimeSeconds) * 1000)
    : 0;
  return clamp(chapterStartMs + localMs, chapterStartMs, chapterEndMs);
}

export function advanceFallbackPlayhead(
  currentMs: number,
  elapsedMs: number,
  scopeStartMs: number,
  scopeEndMs: number,
): number {
  return clamp(currentMs + Math.max(0, elapsedMs), scopeStartMs, scopeEndMs);
}
```

- [ ] **Step 4: Run the clock tests green**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Integrate the audio clock into `EditorPreviewViewport`**

Extend props:

```typescript
onNarrationClock: (globalMs: number) => void;
onNarrationEnded: (globalMs: number) => void;
onNarrationError: (message: string) => void;
```

On the hidden `<audio>` element:

```tsx
onTimeUpdate={(event) => {
  if (narrationStartMs == null || narrationEndMs == null) return;
  onNarrationClock(
    narrationPlayheadMs(event.currentTarget.currentTime, narrationStartMs, narrationEndMs),
  );
}}
onEnded={() => {
  if (narrationEndMs != null) onNarrationEnded(narrationEndMs);
}}
onError={() => {
  setAudioFailed(true);
  onNarrationError("Không thể phát narration audio của chapter này.");
}}
```

Keep the synchronization effect that seeks audio after a user seek or chapter change. Replace swallowed `audio.play()` failures with:

```typescript
void audio.play().catch(() => {
  setAudioFailed(true);
  onNarrationError("Narration audio bị trình phát từ chối hoặc không thể tải.");
});
```

- [ ] **Step 6: Integrate master/fallback selection in `EditorPlaybackSurface`**

Change the timer effect so it runs only while `playing && !narrationUrl`. Use `performance.now()` deltas rather than assuming every interval is exactly 250 ms, call `advanceFallbackPlayhead`, and stop at `scopeWindowEndMs` instead of looping silently.

Wire audio callbacks as follows:

```typescript
const handleNarrationClock = (globalMs: number) => {
  setPlayheadMs(Math.max(scopeWindowStartMs, Math.min(scopeWindowEndMs, globalMs)));
};

const handleNarrationEnded = (globalMs: number) => {
  setPlayheadMs(globalMs);
  if (globalMs >= scopeWindowEndMs) setPlaying(false);
};

const handleNarrationError = (message: string) => {
  setPlaying(false);
  setPlaybackMessage(message);
};
```

Pass `playbackMessage` into the viewport and clear it on a new play attempt or narration URL change. Do not advance with the fallback timer after a real narration URL fails; the UI must show the error instead of simulating successful playback.

- [ ] **Step 7: Run Desktop unit tests and type checking**

Run:

```powershell
npm test
npm run type-check
```

Expected: both commands exit 0; clock helpers and component props type-check.

- [ ] **Step 8: Commit audio-clock behavior**

```powershell
git add app/desktop/src/renderer/features/editor/preview-playback.ts app/desktop/src/renderer/features/editor/components/EditorPlaybackSurface.tsx app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx app/desktop/test/preview-playback.test.mjs
git commit -m "feat(desktop): drive editor playhead from narration audio"
```

---

### Task 4: Show informative pending-media preview cards and clips

**Files:**

- Create: `app/desktop/src/renderer/features/editor/beat-presentation.ts`
- Create: `app/desktop/test/beat-presentation.test.mjs`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx:164`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx:151`

**Interfaces:**

- Produces: `beatPresentation(beat: DesktopTimelineBeat | null): BeatPresentation`.
- `BeatPresentation` contains `state`, `eyebrow`, `title`, `description`, and `timeRange` only; media loading/error messages remain runtime UI state in `EditorPreviewViewport`.

- [ ] **Step 1: Write the failing presentation tests**

Create:

```javascript
test("pending visual beat exposes descriptive preview copy and timing", () => {
  const view = beatPresentation(beat({ mediaAssetId: null, assetReady: false }));
  assert.deepEqual(view, {
    state: "PENDING_MEDIA",
    eyebrow: "CHỜ ẢNH",
    title: "Cổng Vệ Sinh",
    description: "Nhân vật đứng trước cánh cổng phát sáng.",
    timeRange: "00:04.00 – 00:10.00",
  });
});

test("ready beat is not labelled as waiting for an image", () => {
  assert.equal(beatPresentation(beat({ mediaAssetId: "asset-1", assetReady: true })).state, "READY_MEDIA");
});
```

The fixture must use `startMs=4_000`, `endMs=10_000`, the Vietnamese title/intent above, and the complete `DesktopTimelineBeat` shape.

- [ ] **Step 2: Run the presentation test red**

Run:

```powershell
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test test/beat-presentation.test.mjs
```

Expected: FAIL because `beat-presentation.ts` does not exist.

- [ ] **Step 3: Implement the minimal presentation helper**

Use this public shape:

```typescript
export interface BeatPresentation {
  state: "EMPTY" | "PENDING_MEDIA" | "READY_MEDIA";
  eyebrow: string;
  title: string;
  description: string;
  timeRange: string;
}
```

For a pending beat, choose `visualIntent` as description and fall back to `"Visual Beat đã có timing nhưng chưa có mô tả hình ảnh."`. Format `startMs/endMs` as `mm:ss.hh`. For a null beat, return `state="EMPTY"`; for an attached ready asset, return `state="READY_MEDIA"`.

- [ ] **Step 4: Run the presentation test green**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Render the pending-media preview card**

In `EditorPreviewViewport`, compute the presentation once and use it in the existing no-media branch:

```tsx
<span className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
  {presentation.eyebrow}
</span>
<h3 className="mt-2 text-[24px] font-extrabold tracking-tight text-white">
  {presentation.title}
</h3>
<p className="mt-2 font-mono text-[11px] text-text-muted">
  {presentation.timeRange}
</p>
<p className="mt-2.5 max-w-xl text-[13px] leading-5 text-[#7d8b9e]">
  {mediaFailed ? "Không tải được media preview. Render source vẫn được giữ nguyên." : previewMessage || presentation.description}
</p>
```

Keep the existing background visual and loading state, but change the badge to `Chờ ảnh` for `PENDING_MEDIA`. Do not claim `Ready` solely from `assetReady` when the preview URL failed.

- [ ] **Step 6: Distinguish pending clips without changing geometry**

In `EditorMultiTrackTimeline`, derive the presentation for each beat. Continue calculating:

```typescript
const leftPercent = (beat.startMs / effectiveTotalMs) * 100;
const widthPercent = (beat.durationMs / effectiveTotalMs) * 100;
```

For `PENDING_MEDIA`, use a dashed border and muted blue surface, include a compact `Chờ ảnh` label, and omit `LinkIcon`. For `READY_MEDIA`, preserve the existing solid clip and link icon. Both states remain selectable and seek to `beat.startMs`.

- [ ] **Step 7: Run Desktop unit/type/build checks**

Run:

```powershell
npm test
npm run type-check
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit the pending-media UI**

```powershell
git add app/desktop/src/renderer/features/editor/beat-presentation.ts app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx app/desktop/test/beat-presentation.test.mjs
git commit -m "feat(desktop): preview visual beats before images exist"
```

---

### Task 5: Verify the complete user flow and update implementation-facing documentation

**Files:**

- Modify: `documentation/workflows/STORY_TO_VIDEO.md`
- Modify: `documentation/TRACEABILITY.md`

**Interfaces:**

- Consumes: completed backend and Desktop behavior from Tasks 1–4.
- Produces: verified Desktop evidence and documentation matching the current implementation.

- [ ] **Step 1: Update workflow documentation**

Add these facts to the production-timeline section of `STORY_TO_VIDEO.md`:

```markdown
Before a current MediaPlan exists, the production-timeline read model exposes Visual Beats from the Chapter's current storyboard revision as non-renderable draft clips. Draft clips retain persisted audio alignment spans when available and may carry an explicit user-selected image/video, but they cannot satisfy render admission until a current immutable MediaPlan revision exists.

Desktop preview playback uses the active narration element as the master clock. The timer clock is only a no-audio fallback; an audio load/play failure stops playback and is shown to the user.
```

Update the production-timeline row in `TRACEABILITY.md` to mention draft storyboard fallback, pending-media preview, and narration-clock verification.

- [ ] **Step 2: Run focused backend verification**

Run:

```powershell
cd app/backend-service
./mvnw.cmd -Dtest=GetProductionTimelineUseCaseTest,GetProductionTimelineAlignedTimingTest,ProductionTimelineDraftSourceIntegrationTest test
```

Expected: exit 0. If Docker is unavailable, record the Testcontainers test as skipped and do not claim PostgreSQL integration verification.

- [ ] **Step 3: Run the full Desktop check**

Run:

```powershell
cd ../desktop
npm run check
```

Expected: dependency lock, all Node tests, TypeScript checks, and Electron Vite build exit 0.

- [ ] **Step 4: Start or reuse the Desktop development environment**

Run:

```powershell
npm run dev
```

Keep the dev process running in its terminal session. Reuse an existing healthy Electron/Vite session instead when available.

- [ ] **Step 5: Execute the actual editor flow with Desktop/browser automation**

Open a project that has:

```text
completed chapter analysis
current storyboard revision with at least two Visual Beats
ready narration audio
no MediaPlan and no image/video on at least one beat
```

Verify all of the following:

```text
1. Visual Beats track contains one clip per analyzed Visual Beat.
2. Clip left edge and width match its API startMs/endMs.
3. Pending clip is labelled "Chờ ảnh" and remains selectable.
4. Preview shows title, visual intent, and time range without an image.
5. Play starts audible narration and advances the playhead.
6. The selected beat switches exactly when the playhead crosses a beat boundary.
7. Seek updates audio.currentTime and playback resumes from the requested point.
8. Pause freezes both audio and playhead.
9. Crossing into the next chapter loads its narration and keeps the global clock monotonic.
10. A broken narration URL stops playback and displays an error.
11. Console has no uncaught errors; network panel has no unexpected failed API calls.
12. No runtime mock/fake data source is active.
```

- [ ] **Step 6: Capture and inspect screenshot evidence**

Capture at least:

```text
Screenshot A: pending Visual Beat selected, preview card visible, timeline clips visible.
Screenshot B: playback inside a later beat, playhead and selected clip aligned.
```

Inspect horizontal overflow at 100% and 125% display scaling and verify the inspector/preview/timeline remain usable.

- [ ] **Step 7: Run the repository-wide local gate**

From the repository root:

```powershell
pwsh -File scripts/verify-local.ps1
```

Expected: secret scan, backend verify/coverage/format, worker tests/lint/type checks, Desktop install/tests/type/build, and Compose validation all exit 0. If an unrelated pre-existing failure occurs, capture the exact command/output and separate it from feature status.

- [ ] **Step 8: Review the final diff against requirements**

Run:

```powershell
git diff --check
git diff -- app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml app/backend-service/src/test app/desktop/src/renderer/features/editor app/desktop/test documentation/workflows/STORY_TO_VIDEO.md documentation/TRACEABILITY.md
```

Confirm:

```text
draft beats visible without MediaPlan
exact persisted alignment used when complete
no render-readiness regression
audio is master clock
audio failures are visible
pending preview card contains title/intent/time
pending timeline clips preserve geometry and selection
documentation describes AS-IS behavior only
```

- [ ] **Step 9: Commit verification-facing documentation**

```powershell
git add documentation/workflows/STORY_TO_VIDEO.md documentation/TRACEABILITY.md
git commit -m "docs: describe draft timeline preview behavior"
```
