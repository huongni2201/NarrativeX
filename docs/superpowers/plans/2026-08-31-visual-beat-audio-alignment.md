# Visual Beat Audio Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist semantic source ranges for visual beats and deterministically map them onto the authoritative narration clock so image transitions align with the spoken source instead of duration weighting.

**Architecture:** Chapter analysis returns verbatim `source_anchor` text for each visual beat. The AI worker resolves anchors to UTF-16 `text_start/text_end`, then a shared reconciliation function maps ordered beat starts through narration alignment spans into a contiguous `audio_start_ms/audio_end_ms` clock ending exactly at narration duration. Reconciliation runs after either storyboard or narration completion, so parallel job order does not affect results.

**Tech Stack:** Python 3.12, Pydantic, asyncpg, Java 25/Spring, MyBatis, PostgreSQL, pytest/JUnit.

**Spec:** `docs/superpowers/specs/2026-08-31-visual-beat-audio-alignment-design.md`

## Global Constraints

- Audio remains the authoritative clock.
- AI must never invent millisecond timestamps or numeric character offsets.
- Source offsets use UTF-16 units, matching existing narration alignment spans.
- Exact ordered source-anchor resolution is required; no fuzzy semantic matching.
- `visual_beats.text_start`, `text_end`, `audio_start_ms`, and `audio_end_ms` already exist; do not add a migration.
- Missing exact timing remains render-blocking; do not weaken admission rules.

---

### Task 1: Source-anchor contract and deterministic UTF-16 resolution

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/schema.py`
- Modify: `app/ai-worker/src/narrativex_worker/prompting.py`
- Create: `app/ai-worker/src/narrativex_worker/visual_alignment.py`
- Modify: `app/ai-worker/tests/test_prompting.py`
- Create: `app/ai-worker/tests/test_visual_alignment.py`

**Interfaces:**
- Produces: `VisualBeatAnalysis.source_anchor: str`
- Produces: `ResolvedVisualBeatRange(text_start: int, text_end: int)`
- Produces: `resolve_visual_beat_ranges(source_text: str, anchors: Sequence[str]) -> list[ResolvedVisualBeatRange]`

- [ ] **Step 1: Write failing schema/prompt tests**

Add tests asserting a visual beat requires `source_anchor`, the output schema advertises it, and the prompt requires a verbatim contiguous source excerpt while explicitly prohibiting guessed timestamps/offsets.

- [ ] **Step 2: Write failing resolver tests**

Cover ordered exact matches, repeated text resolved after the prior anchor, Vietnamese/non-BMP UTF-16 offsets, missing anchors, and out-of-order anchors.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
cd app/ai-worker && pytest tests/test_prompting.py tests/test_visual_alignment.py -q
```

Expected: failures because `source_anchor` and `resolve_visual_beat_ranges` do not exist.

- [ ] **Step 4: Implement minimal schema/prompt/resolver**

`VisualBeatAnalysis` adds:

```python
source_anchor: str = Field(min_length=1, max_length=2000)
```

`resolve_visual_beat_ranges` searches from `previous_codepoint_end`, uses `codepoint_to_utf16_offset`, and raises `ValueError` with the beat index when the anchor cannot be found in sequence.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same pytest command; expected 0 failures.

- [ ] **Step 6: Commit**

```bash
git add app/ai-worker/src/narrativex_worker/schema.py app/ai-worker/src/narrativex_worker/prompting.py app/ai-worker/src/narrativex_worker/visual_alignment.py app/ai-worker/tests/test_prompting.py app/ai-worker/tests/test_visual_alignment.py
git commit -m "feat: anchor visual beats to source text"
```

---

### Task 2: Persist visual text ranges during storyboard materialization

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/materialization/storyboard.py`
- Modify: `app/ai-worker/tests/test_continuity_materialization.py`

**Interfaces:**
- Consumes: `resolve_visual_beat_ranges(...)`
- Persists: `visual_beats.text_start`, `visual_beats.text_end`

- [ ] **Step 1: Update test fixture with source-backed anchors**

Use source text and visual beat anchors that are actual contiguous excerpts from the immutable chapter source.

- [ ] **Step 2: Add failing persistence assertions**

Assert `INSERT INTO visual_beats` contains `text_start,text_end` and receives UTF-16 ranges matching the anchors.

- [ ] **Step 3: Run materialization test and verify RED**

```bash
cd app/ai-worker && pytest tests/test_continuity_materialization.py -q
```

- [ ] **Step 4: Resolve ranges once before beat insertion**

Flatten anchors in scene/beat order, resolve against `claimed.request.source_text`, and include the corresponding text range in every beat row. Keep `audio_start_ms/audio_end_ms` untouched at this task boundary.

- [ ] **Step 5: Run test and verify GREEN**

Run the same pytest target; expected 0 failures.

- [ ] **Step 6: Commit**

```bash
git add app/ai-worker/src/narrativex_worker/materialization/storyboard.py app/ai-worker/tests/test_continuity_materialization.py
git commit -m "feat: persist visual beat source ranges"
```

---

### Task 3: Map text ranges to a contiguous narration clock

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/visual_alignment.py`
- Modify: `app/ai-worker/tests/test_visual_alignment.py`

**Interfaces:**
- Produces: `VisualAudioRange(audio_start_ms: int, audio_end_ms: int)`
- Produces: `map_visual_ranges_to_audio(text_ranges, alignment_spans, audio_duration_ms) -> list[VisualAudioRange]`

- [ ] **Step 1: Write failing mapping tests**

Cover text positions at span boundaries, positions inside spans, multiple narration spans, UTF-16 widths, contiguous output, exact final duration, and rejection of non-monotonic mapped starts.

- [ ] **Step 2: Run tests and verify RED**

```bash
cd app/ai-worker && pytest tests/test_visual_alignment.py -q
```

- [ ] **Step 3: Implement deterministic interpolation**

Map each beat `text_start` into the containing narration span using `Fraction`; force first start to `0`, use later mapped starts as transitions, and build each end from the next start. Final end is exactly `audio_duration_ms`.

- [ ] **Step 4: Validate invariants**

Reject empty alignment, missing containing spans, decreasing/duplicate transitions, negative offsets, or transitions at/after final duration for non-final beats.

- [ ] **Step 5: Run tests and verify GREEN**

Run the same pytest target; expected 0 failures.

- [ ] **Step 6: Commit**

```bash
git add app/ai-worker/src/narrativex_worker/visual_alignment.py app/ai-worker/tests/test_visual_alignment.py
git commit -m "feat: map visual ranges to narration clock"
```

---

### Task 4: Reconcile visual beat audio timing after either job completes

**Files:**
- Create: `app/ai-worker/src/narrativex_worker/visual_timing_reconciliation.py`
- Create: `app/ai-worker/tests/test_visual_timing_reconciliation.py`
- Modify: `app/ai-worker/src/narrativex_worker/materialization/storyboard.py`
- Modify: `app/ai-worker/src/narrativex_worker/narration/repository/implementation.py`

**Interfaces:**
- Produces: `reconcile_visual_beat_audio_timing(connection, *, chapter_id, chapter_row_version, source_hash) -> bool`
- Returns `False` when either current storyboard ranges or matching narration alignment is not yet available; returns `True` after updating all eligible beats.

- [ ] **Step 1: Write failing reconciliation tests**

Use a fake asyncpg connection to cover: storyboard-first without narration returns false; narration-first without storyboard ranges returns false; both available updates all beats; stale source hash/row version never updates another revision.

- [ ] **Step 2: Run tests and verify RED**

```bash
cd app/ai-worker && pytest tests/test_visual_timing_reconciliation.py -q
```

- [ ] **Step 3: Implement scoped database read**

Load the chapter's current storyboard beats ordered by scene/beat, requiring non-null `text_start/text_end`. Load the latest narration asset/alignment matching chapter id, row version, and source hash. Parse `spans_json` into existing `AlignmentSpan` objects and use the pure mapper from Task 3.

- [ ] **Step 4: Persist one authoritative audio clock**

Update each beat by id with mapped `audio_start_ms/audio_end_ms`, `updated_at=CURRENT_TIMESTAMP`, and increment `row_version` only for the current storyboard revision.

- [ ] **Step 5: Call reconciliation from both completion paths**

After activating the storyboard revision, call reconciliation. After narration alignment insertion in `NarrationWorkerRepository.complete`, call the same reconciliation before the transaction commits.

- [ ] **Step 6: Run tests and verify GREEN**

Run reconciliation tests plus continuity materialization and narration repository tests.

- [ ] **Step 7: Commit**

```bash
git add app/ai-worker/src/narrativex_worker/visual_timing_reconciliation.py app/ai-worker/tests/test_visual_timing_reconciliation.py app/ai-worker/src/narrativex_worker/materialization/storyboard.py app/ai-worker/src/narrativex_worker/narration/repository/implementation.py
git commit -m "feat: reconcile visual timing with narration"
```

---

### Task 5: Preserve existing timing fields through backend storyboard persistence

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/domain/entity/VisualBeat.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/mybatis/VisualBeatRow.java`
- Modify: `app/backend-service/src/main/resources/mybatis/StoryboardMapper.xml`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisStoryboardPersistenceAdapter.java`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisStoryboardPersistenceAdapterTest.java`

**Interfaces:**
- `VisualBeat` exposes `getTextStart()`, `getTextEnd()`, `getAudioStartMs()`, `getAudioEndMs()`.
- `VisualBeatRow` maps corresponding nullable fields.

- [ ] **Step 1: Write failing adapter test**

Rehydrate a mapper row with all four timing values and assert the domain object retains them; save the domain object and assert the outgoing row carries the same values.

- [ ] **Step 2: Run test and verify RED**

Use the repository's focused backend test command for the new test class.

- [ ] **Step 3: Add timing fields to domain/row/mapper**

Extend the full `rehydrate` path with nullable timing fields, preserve backward-compatible constructors with null defaults, and add mapper result/select/insert/update columns.

- [ ] **Step 4: Run focused test and verify GREEN**

Expected 0 failures.

- [ ] **Step 5: Commit**

```bash
git add app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/domain/entity/VisualBeat.java app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/mybatis/VisualBeatRow.java app/backend-service/src/main/resources/mybatis/StoryboardMapper.xml app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisStoryboardPersistenceAdapter.java app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisStoryboardPersistenceAdapterTest.java
git commit -m "fix: retain storyboard timing fields"
```

---

### Task 6: Feed exact visual audio timing into media planning

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/service/MediaPlanningSourceService.java`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/application/service/MediaPlanningSourceServiceTest.java`

**Interfaces:**
- Consumes: `VisualBeat.getAudioStartMs()/getAudioEndMs()`
- Produces: `MediaPlanningSource.BeatSnapshot.audioStartMs/audioEndMs`

- [ ] **Step 1: Write failing service test**

Create a domain beat with exact `0..8430` timing and assert `requireCurrent` returns those values instead of null.

- [ ] **Step 2: Run test and verify RED**

Expected failure because the service currently hard-codes both fields to null.

- [ ] **Step 3: Replace hard-coded null timing**

Pass `beat.getAudioStartMs()` and `beat.getAudioEndMs()` into `BeatSnapshot`.

- [ ] **Step 4: Run test and verify GREEN**

Expected 0 failures.

- [ ] **Step 5: Commit**

```bash
git add app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/service/MediaPlanningSourceService.java app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/application/service/MediaPlanningSourceServiceTest.java
git commit -m "fix: expose aligned visual timing to media plans"
```

---

### Task 7: End-to-end verification and PR update

**Files:**
- Modify only if verification exposes a defect in the planned behavior.

- [ ] **Step 1: Run AI worker targeted suite**

```bash
cd app/ai-worker && pytest tests/test_prompting.py tests/test_visual_alignment.py tests/test_visual_timing_reconciliation.py tests/test_continuity_materialization.py tests/test_narration_alignment_precision.py tests/test_local_narration_runner.py -q
```

Expected: 0 failures.

- [ ] **Step 2: Run AI worker formatter/linter/type checks used by CI**

Use the exact repository CI commands from workflow configuration; expected exit 0.

- [ ] **Step 3: Run focused backend tests**

Run the new persistence/service tests plus `GetProductionTimelineUseCaseTest` and local-first timeline integration coverage; expected 0 failures.

- [ ] **Step 4: Run backend verify command used by CI**

Expected exit 0.

- [ ] **Step 5: Re-run desktop subtitle/render timing regression**

Expected existing audio-master-clock tests to remain green.

- [ ] **Step 6: Inspect final diff**

Confirm no migration was added, no render-readiness tolerance was loosened, and no AI timestamp fields were introduced.

- [ ] **Step 7: Update PR #406 body**

Document source-anchor timing, exact UTF-16 provenance, order-independent reconciliation, verification results, and the remaining limitation that inside-segment timing is interpolation rather than word-level forced alignment.
