# Draft Visual Beat Preview and Audio Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show source-grounded Visual Beats immediately after Chapter analysis, convert them deterministically into narration-aligned timeline clips when audio alignment exists, and make narration audio the authoritative Desktop playback clock without requiring a MediaPlan or generated image first.

**Architecture:** Split Visual Beat timing into three explicit coordinate systems instead of asking AI to invent timestamps. Chapter analysis returns semantic source-segment references; the worker materializes deterministic UTF-16 `text_start/text_end` offsets on `chapters.source_text`; a `VisualBeatTimingReconciler` later projects those text spans through persisted narration alignment into `audio_start_ms/audio_end_ms`. Production timeline reads prefer a current immutable MediaPlan, otherwise expose current storyboard beats as draft clips. Draft clips may be `PROVISIONAL` before audio alignment and become `ALIGNED` only after narration timing is reconciled. Desktop uses real narration audio as the master clock whenever available.

**Tech Stack:** Python 3.13 · Pydantic · asyncpg/PostgreSQL · Java 25 · Spring Boot 4.1 · MyBatis · JUnit 5/AssertJ/Testcontainers · Electron 43 · React 19 · TypeScript 7 · Node test runner

**Spec:** In-chat bounded design approved on 2026-08-28 and refined after review of the original plan; no separate architecture spec is required.

## Global Constraints

- PostgreSQL remains authoritative for storyboard, source offsets, narration alignment, timing, media selections, and production-timeline reads.
- AI must never calculate character offsets or audio timestamps.
- Visual Beat source positions use UTF-16 half-open ranges `[text_start, text_end)` over the exact persisted `chapters.source_text` snapshot identified by `source_hash` and `row_version`.
- `audio_start_ms/audio_end_ms` remain `NULL` until an applicable narration alignment exists; missing audio timing must not be silently represented as exact alignment.
- `aspect_ratio_override` and `quality_tier_override` remain nullable override fields; `NULL` means inherit project/default policy and is not missing analysis data.
- Narration is the visual master clock once real audio exists.
- A current valid MediaPlan always takes precedence over storyboard draft rows.
- Draft beats are inspectable/editable but never make `readyForRender=true` without a valid MediaPlan and ready assets.
- Do not create a MediaPlan, reserve cost, or enqueue provider work merely to make draft beats visible.
- Desktop renderer receives URLs and stable IDs only; it does not gain Node.js, filesystem, or process access.
- Existing user changes in the worktree must be preserved.
- Behavior changes follow red-green-refactor; integration claims require the relevant PostgreSQL/Desktop runtime verification.

## Timing Model

```text
chapters.source_text
  -> deterministic source segments
  -> AI selects contiguous segment IDs per Visual Beat
  -> worker resolves UTF-16 text_start/text_end
  -> narration generation/import produces alignment spans
  -> VisualBeatTimingReconciler maps text spans to audio spans
  -> visual_beats.audio_start_ms/audio_end_ms
  -> chapterStartMs + local audio offsets
  -> ProductionTimeline Beat.startMs/endMs
  -> Desktop timeline + narration-master playhead
```

### Timing states

```text
SOURCE_ONLY
  text_start/text_end present
  audio_start_ms/audio_end_ms null

ALIGNED
  text_start/text_end present
  audio_start_ms/audio_end_ms present and validated against narration duration

PLANNED
  immutable MediaPlan timing exists and takes precedence for render planning
```

The API/UI may call `SOURCE_ONLY` timing `PROVISIONAL`; it must not label it narration-aligned.

## File Map

- Modify `app/ai-worker/src/narrativex_worker/schema.py`: add source-segment references to Visual Beat analysis output, never numeric offsets/timestamps.
- Modify `app/ai-worker/src/narrativex_worker/prompting.py`: provide stable source segment IDs and require contiguous source-span references.
- Reuse/refactor `app/ai-worker/src/narrativex_worker/narration/segmenter.py`: one UTF-16 offset convention shared by narration and Visual Beat source materialization.
- Modify `app/ai-worker/src/narrativex_worker/materialization/storyboard.py`: resolve source segment references and persist `visual_beats.text_start/text_end`.
- Create `app/ai-worker/src/narrativex_worker/timing/visual_beat.py`: pure text-to-audio interpolation/reconciliation helpers.
- Modify `app/ai-worker/src/narrativex_worker/narration/repository/completion.py`: reconcile current storyboard beat timing after durable narration alignment is inserted.
- Modify/add AI-worker tests covering source spans, Unicode UTF-16 offsets, stale-source guards, interpolation and contiguous normalization.
- Create/modify backend draft timeline tests and `ProductionTimelineMapper.xml`: expose current storyboard beats without a MediaPlan.
- Modify `GetProductionTimelineUseCase` tests/read model so exact alignment is distinguishable from provisional fallback timing.
- Modify Desktop production contract if a `timingState` field is required by UI.
- Modify Desktop playback/presentation/timeline components for narration-master playback and pending/provisional states.
- Modify `documentation/workflows/STORY_TO_VIDEO.md`, `documentation/workflows/NARRATION_AUDIO.md`, and `documentation/TRACEABILITY.md`.

---

### Task 1: Give AI stable source-segment references instead of numeric offsets

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/schema.py`
- Modify: `app/ai-worker/src/narrativex_worker/prompting.py`
- Modify: `app/ai-worker/src/narrativex_worker/narration/segmenter.py`
- Test: `app/ai-worker/tests/test_prompting.py`
- Test: add/update focused schema/segmenter tests under `app/ai-worker/tests/`

**Interfaces:**
- Produces `SourceSegment(id: str, text: str, text_start: int, text_end: int)` internally.
- Produces `VisualBeatAnalysis.source_span.start_segment_id/end_segment_id` from AI.
- Numeric UTF-16 offsets remain worker-owned and are not part of the AI output schema.

- [ ] **Step 1: Write failing schema tests**

Lock this contract:

```python
beat = VisualBeatAnalysis.model_validate({
    "title": "Phát hiện chiếc hộp",
    "visual_intent": "Nhân vật nhìn thấy chiếc hộp trên bàn.",
    "camera_angle": "MEDIUM",
    "characters": [],
    "source_span": {
        "start_segment_id": "s0002",
        "end_segment_id": "s0003",
    },
})
assert beat.source_span.start_segment_id == "s0002"
```

Also assert unknown numeric timing fields are rejected by `extra="forbid"`:

```python
with pytest.raises(ValidationError):
    VisualBeatAnalysis.model_validate({..., "text_start": 123})
```

- [ ] **Step 2: Add a shared deterministic source-segment representation**

Refactor the existing narration segmentation helpers instead of creating a second offset convention. Segment IDs must be deterministic by order (`s0001`, `s0002`, ...), and each segment carries UTF-16 half-open offsets computed using the existing `utf16_length/codepoint_to_utf16_offset` logic.

- [ ] **Step 3: Update prompt construction**

Send source material as an ordered list such as:

```json
[
  {"id":"s0001","text":"Lâm bước vào căn phòng. "},
  {"id":"s0002","text":"Anh nhìn thấy chiếc hộp trên bàn. "}
]
```

Add exact instructions:

```text
Every Visual Beat must reference one contiguous SOURCE_SEGMENTS range.
Never calculate or return character offsets or audio timestamps.
Never invent segment IDs.
start_segment_id and end_segment_id must exist in SOURCE_SEGMENTS.
Visual Beat source ranges must preserve story order.
```

Update `OUTPUT_SCHEMA` to include `source_span` only.

- [ ] **Step 4: Add Unicode regression coverage**

Use Vietnamese text plus an astral Unicode character/emoji and assert segment offsets are UTF-16 units, not Python code-point counts.

- [ ] **Step 5: Run worker unit checks**

```powershell
cd app/ai-worker
pytest tests/test_prompting.py -q
pytest -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/ai-worker/src/narrativex_worker/schema.py app/ai-worker/src/narrativex_worker/prompting.py app/ai-worker/src/narrativex_worker/narration/segmenter.py app/ai-worker/tests
git commit -m "feat(worker): ground visual beats in source segments"
```

---

### Task 2: Materialize exact UTF-16 source spans on Visual Beats

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/materialization/storyboard.py`
- Test: add/update storyboard materialization tests under `app/ai-worker/tests/`

**Interfaces:**
- Consumes AI `source_span` segment IDs plus the exact `claimed.request.source_text` snapshot.
- Produces non-null `visual_beats.text_start/text_end` for every successfully materialized analyzed beat.
- Leaves `audio_start_ms/audio_end_ms` null unless a separate reconciliation step has authoritative narration alignment.

- [ ] **Step 1: Write failing source-span materialization tests**

For two beats referencing adjacent source ranges, assert persisted rows contain deterministic UTF-16 offsets and preserve `[start,end)` ordering.

- [ ] **Step 2: Add strict source-span validation**

Reject analysis materialization when:

```text
segment ID is unknown
end segment precedes start segment
beat ranges move backward in source order
resolved end <= resolved start
resolved end exceeds UTF-16 source length
```

Do not repair these cases by guessing.

- [ ] **Step 3: Persist text offsets**

Extend the `visual_beats` insert to include `text_start,text_end`. Keep `aspect_ratio_override`, `quality_tier_override`, `audio_start_ms`, and `audio_end_ms` untouched/null at this stage.

- [ ] **Step 4: Preserve stale-source protection**

The existing storyboard revision `source_hash` and `source_row_version` checks remain mandatory. A source span is valid only for the exact source snapshot that produced it.

- [ ] **Step 5: Run materialization tests**

```powershell
cd app/ai-worker
pytest -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/ai-worker/src/narrativex_worker/materialization/storyboard.py app/ai-worker/tests
git commit -m "feat(worker): persist visual beat source spans"
```

---

### Task 3: Reconcile Visual Beat source spans onto real narration time

**Files:**
- Create: `app/ai-worker/src/narrativex_worker/timing/visual_beat.py`
- Modify: `app/ai-worker/src/narrativex_worker/narration/repository/completion.py`
- Test: create `app/ai-worker/tests/test_visual_beat_timing.py`
- Test: update narration completion PostgreSQL tests where appropriate

**Interfaces:**
- Consumes persisted beat `[text_start,text_end)` and `AlignmentSpan(text_start,text_end,audio_start_ms,audio_end_ms)` values.
- Produces local chapter `[audio_start_ms,audio_end_ms)` for each beat.
- Reconciliation is deterministic and idempotent for `(chapter source hash, storyboard revision, narration alignment)`.

- [ ] **Step 1: Write pure interpolation tests**

Example:

```python
span = AlignmentSpan(index=0, text_start=0, text_end=200, audio_start_ms=0, audio_end_ms=6000)
assert project_text_offset_to_audio_ms(80, span) == 2400
```

Cover exact boundaries, multi-span beats, zero-width/invalid spans, Unicode-independent numeric offsets, and clamping to the narration duration.

- [ ] **Step 2: Define interpolation rules**

Within one alignment span:

```text
ratio = (text_offset - span.text_start) / (span.text_end - span.text_start)
audio = span.audio_start_ms + ratio * (span.audio_end_ms - span.audio_start_ms)
```

For a beat crossing alignment spans, derive its start from the span containing/intersecting `text_start` and its end from the span containing/intersecting `text_end`. Round deterministically to integer milliseconds.

- [ ] **Step 3: Normalize the complete ordered beat sequence**

For an aligned chapter, enforce:

```text
first audio_start_ms = 0
beat[i].audio_end_ms = beat[i+1].audio_start_ms
last audio_end_ms = narration duration
all beat durations > 0
all values monotonic and within [0, narration duration]
```

Use semantic beat/source boundaries to determine interior boundaries; normalization removes rounding gaps/overlaps only. Do not redistribute all beats uniformly.

- [ ] **Step 4: Add a stale/incompatible-alignment guard**

Reconcile only when narration alignment `source_hash` matches the current chapter/storyboard source snapshot. If it does not match, leave beat audio offsets null and surface the incompatibility through existing job/error diagnostics rather than writing stale timing.

- [ ] **Step 5: Trigger reconciliation after narration completion**

After the narration asset and `narration_alignments` row are durably inserted inside the same transaction, resolve the chapter's current storyboard revision and update all beats that have valid text spans.

The operation must also work idempotently on retry. The existing idempotent-completion branch must ensure timing is already reconciled or invoke the same reconciliation helper before returning.

- [ ] **Step 6: Cover the reverse order**

Add a materialization-side hook or reusable repository function so this also works when narration already exists before Chapter analysis completes:

```text
Audio first -> analysis later -> materialize text spans -> find compatible current alignment -> reconcile.
Analysis first -> audio later -> narration completion -> reconcile.
```

- [ ] **Step 7: Run worker tests**

```powershell
cd app/ai-worker
pytest -q
ruff check .
```

Run the repository's configured type-check command as well.

- [ ] **Step 8: Commit**

```powershell
git add app/ai-worker/src/narrativex_worker/timing app/ai-worker/src/narrativex_worker/narration/repository/completion.py app/ai-worker/src/narrativex_worker/materialization/storyboard.py app/ai-worker/tests
git commit -m "feat(worker): reconcile visual beats to narration time"
```

---

### Task 4: Expose current storyboard beats before a MediaPlan exists

**Files:**
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ProductionTimelineDraftSourceIntegrationTest.java`
- Modify: `app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml`
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/GetProductionTimelineUseCaseTest.java`

**Interfaces:**
- Consumes current storyboard Visual Beats with nullable plan/media/timing fields.
- Produces production-timeline rows for draft beats when no valid current MediaPlan exists.
- Planned rows always supersede draft rows.

- [ ] **Step 1: Write PostgreSQL tests for SOURCE_ONLY draft beats**

Insert a current storyboard with two beats that have `text_start/text_end` but null `audio_start_ms/audio_end_ms`; assert `findBeats` returns both Visual Beat identities instead of zero rows.

- [ ] **Step 2: Write PostgreSQL tests for ALIGNED draft beats**

Set exact spans `[0,4000]` and `[4000,10000]`; assert the mapper preserves them exactly.

- [ ] **Step 3: Implement planned-or-draft CTE**

Use the current completed MediaPlan when valid. Otherwise join `chapters.current_storyboard_revision_id -> scenes -> visual_beats`. Keep explicit selected-media lookup available for draft beats. Add `WHERE cc.media_plan_id IS NULL` to the draft half to prevent duplicate planned/draft rows.

- [ ] **Step 4: Add draft chapter counts**

`beatCount` must count current storyboard beats when there is no MediaPlan. `readyBeatCount` may count explicit valid media selections, but render admission remains false without a plan.

- [ ] **Step 5: Keep render admission closed**

Add application tests proving draft beats can be visible/selectable while `chapter.readyForRender=false` and `timeline.readyForRender=false`.

- [ ] **Step 6: Remove misleading exact-timing fallback semantics**

Current `GetProductionTimelineUseCase.planBeatTiming()` may evenly/weight-distribute beats when exact aligned clock is incomplete. Preserve that only as a clearly provisional display fallback if required for geometry; do not treat generated positions as narration alignment.

Preferred contract: add an explicit beat/timeline timing state such as:

```text
SOURCE_ONLY / PROVISIONAL / ALIGNED / PLANNED
```

If the public contract is extended, update `ProductionTimelineView`, `packages/client-contracts/src/production.ts`, mapping code and tests together.

- [ ] **Step 7: Run backend tests**

```powershell
cd app/backend-service
./mvnw.cmd -Dtest=GetProductionTimelineUseCaseTest,GetProductionTimelineAlignedTimingTest,ProductionTimelineDraftSourceIntegrationTest test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml app/backend-service/src/main/java/com/narrativex/backend/feature/generation app/backend-service/src/test packages/client-contracts/src/production.ts
git commit -m "feat(backend): expose timed draft storyboard beats"
```

---

### Task 5: Make narration audio the Desktop playhead authority

**Files:**
- Modify: `app/desktop/src/renderer/features/editor/preview-playback.ts`
- Modify: `app/desktop/test/preview-playback.test.mjs`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPlaybackSurface.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`

**Interfaces:**
- Produces `narrationPlayheadMs(currentTimeSeconds, chapterStartMs, chapterEndMs): number`.
- Produces `advanceFallbackPlayhead(currentMs, elapsedMs, scopeStartMs, scopeEndMs): number` for scopes with no real narration URL only.
- Real audio load/play failure stops playback; it must not silently switch to simulated success.

- [ ] **Step 1: Add pure clock tests**

```javascript
test("narration audio time maps to global project clock", () => {
  assert.equal(narrationPlayheadMs(2.5, 10_000, 20_000), 12_500);
  assert.equal(narrationPlayheadMs(12, 10_000, 20_000), 20_000);
});
```

- [ ] **Step 2: Implement clamped audio-clock helpers**

Use real `HTMLAudioElement.currentTime` and map chapter-local seconds to global timeline milliseconds.

- [ ] **Step 3: Wire `EditorPreviewViewport` audio events**

Emit `onNarrationClock`, `onNarrationEnded`, and visible `onNarrationError`. Keep seek synchronization from global playhead back into `audio.currentTime`.

- [ ] **Step 4: Disable periodic timer while narration URL is active**

The timer is a no-audio fallback only. Do not run two competing clocks.

- [ ] **Step 5: Run Desktop tests/type-check**

```powershell
cd app/desktop
npm test
npm run type-check
```

- [ ] **Step 6: Commit**

```powershell
git add app/desktop/src/renderer/features/editor app/desktop/test/preview-playback.test.mjs
git commit -m "feat(desktop): drive editor playhead from narration audio"
```

---

### Task 6: Represent pending media and provisional/aligned timing honestly in UI

**Files:**
- Create: `app/desktop/src/renderer/features/editor/beat-presentation.ts`
- Create: `app/desktop/test/beat-presentation.test.mjs`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx`

**Interfaces:**
- Produces `BeatPresentation` from a `DesktopTimelineBeat`.
- Separates media state (`PENDING_MEDIA/READY_MEDIA`) from timing state (`PROVISIONAL/ALIGNED/PLANNED`).

- [ ] **Step 1: Add presentation tests**

Cover:

```text
no image + aligned timing -> Chờ ảnh + exact time range
no image + provisional timing -> Chờ ảnh + timing indicator “Ước tính”
ready media + aligned timing -> Ready media without “Chờ ảnh”
```

- [ ] **Step 2: Implement view-model helper**

Do not infer `ALIGNED` merely because `startMs/endMs` exist if those values came from fallback geometry; use the explicit timing state from the backend/client contract when added in Task 4.

- [ ] **Step 3: Render pending preview cards**

Show title, visual intent, timing label and media status before image generation completes.

- [ ] **Step 4: Preserve exact clip geometry for aligned/planned beats**

For provisional beats, geometry may be displayed for navigation but must be visually distinct and must not claim exact narration synchronization.

- [ ] **Step 5: Run Desktop checks**

```powershell
cd app/desktop
npm test
npm run type-check
npm run build
```

- [ ] **Step 6: Commit**

```powershell
git add app/desktop/src/renderer/features/editor app/desktop/test packages/client-contracts/src/production.ts
git commit -m "feat(desktop): distinguish provisional and aligned visual beats"
```

---

### Task 7: Verify end-to-end timing lifecycle and update implementation-facing documentation

**Files:**
- Modify: `documentation/workflows/STORY_TO_VIDEO.md`
- Modify: `documentation/workflows/NARRATION_AUDIO.md`
- Modify: `documentation/TRACEABILITY.md`

**Interfaces:**
- Consumes Tasks 1-6.
- Produces verified documentation that distinguishes intended contract from actually verified implementation.

- [ ] **Step 1: Verify analysis-before-audio lifecycle**

Create/analyze a chapter before narration exists and verify:

```text
visual_beats.text_start/text_end are populated
visual_beats.audio_start_ms/audio_end_ms are null
UI may show beats as provisional/source-only
readyForRender remains false
```

Then generate narration and verify the same beat rows gain monotonic audio spans covering the narration duration.

- [ ] **Step 2: Verify audio-before-analysis lifecycle**

Create narration first, then analyze the exact same source snapshot. Verify storyboard materialization finds the compatible alignment and produces aligned beat timing without requiring narration regeneration.

- [ ] **Step 3: Verify stale source behavior**

Change chapter source after narration/alignment or analysis snapshot creation. Verify stale alignment is not applied to the new source and no stale timing is written.

- [ ] **Step 4: Verify draft timeline without MediaPlan**

Confirm current storyboard beats are visible, selectable and non-renderable. Aligned beats use exact persisted audio spans. Provisional beats are visibly marked as estimates if fallback geometry is shown.

- [ ] **Step 5: Verify narration-master Desktop playback**

Confirm:

```text
play starts audible narration
playhead follows audio.currentTime
beat selection changes at aligned boundaries
seek updates audio.currentTime
pause freezes both audio and playhead
broken narration URL stops playback and surfaces an error
```

- [ ] **Step 6: Run focused automated verification**

```powershell
cd app/ai-worker
pytest -q

cd ../backend-service
./mvnw.cmd -Dtest=GetProductionTimelineUseCaseTest,GetProductionTimelineAlignedTimingTest,ProductionTimelineDraftSourceIntegrationTest test

cd ../desktop
npm run check
```

- [ ] **Step 7: Run repository-wide gate**

```powershell
pwsh -File scripts/verify-local.ps1
```

Record unrelated pre-existing failures separately; do not claim verification that did not run.

- [ ] **Step 8: Update docs as AS-IS only after verification**

`STORY_TO_VIDEO.md` must document the source-span -> alignment -> project-timeline chain. `NARRATION_AUDIO.md` must document Visual Beat reconciliation as a consumer of alignment. `TRACEABILITY.md` may be upgraded to `IMPLEMENTED foundation` only after the relevant worker/backend/Desktop tests pass; otherwise leave the feature `TARGET/PARTIAL` with a precise gap.

- [ ] **Step 9: Commit docs**

```powershell
git add documentation/workflows/STORY_TO_VIDEO.md documentation/workflows/NARRATION_AUDIO.md documentation/TRACEABILITY.md
git commit -m "docs: define visual beat timing lifecycle"
```

---

## Final Acceptance Criteria

```text
1. AI never returns text/audio numeric offsets.
2. Every analyzed Visual Beat has deterministic UTF-16 text_start/text_end for its exact source snapshot.
3. Narration alignment is the only source of exact beat audio timing before MediaPlan creation.
4. audio_start_ms/audio_end_ms remain NULL until compatible alignment exists.
5. Reconciliation works whether analysis or narration completes first.
6. Stale source/alignment combinations never write timing.
7. Draft storyboard beats are visible without a MediaPlan but never render-ready.
8. Planned MediaPlan rows supersede draft rows.
9. Desktop audio is the master playback clock whenever narration exists.
10. UI distinguishes provisional timing from aligned/planned timing.
11. Pending media does not hide a valid Visual Beat from the timeline.
12. Project/global startMs/endMs are derived from chapter start plus local narration timing, not AI estimates.
```
