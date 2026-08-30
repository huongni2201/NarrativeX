# Visual Timing Migration Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove superseded duration-weighted and Python visual-audio timing code, keep the source-anchor resolver as the AI worker's only visual timing responsibility, and synchronize documentation/PR metadata with the final architecture.

**Architecture:** The AI worker owns only `source_anchor -> UTF-16 text_start/text_end`. Narration alignment owns the authoritative audio clock, and backend `NarrationTextClockMapper` maps source ranges to audio timing when Production Timeline is read. Existing persisted beat audio fields and media-plan timing fields remain for compatibility because they still have consumers.

**Tech Stack:** Python 3.12, pytest, Ruff, Mypy, Java 25, Spring Boot 4.1, Jackson 3, MyBatis, Maven, Node 24, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-31-visual-timing-cleanup-design.md`

## Global Constraints

- Remove code only when repository search shows no production consumer.
- Do not remove `MediaPlanningSource.BeatSnapshot.audioStartMs/audioEndMs`.
- Do not remove `visual_beats.audio_start_ms/audio_end_ms` database fields or Production Timeline support for persisted exact timing.
- Keep `VisualBeatAnalysis.source_anchor` nullable for legacy/test payload compatibility.
- Do not weaken render-readiness or malformed-timing fallback behavior.
- Do not introduce a database migration.
- Do not add forced word/phoneme alignment in this cleanup.
- Final completion requires all CI jobs to pass on the exact final head.

---

## File Structure

### Delete

- `app/ai-worker/src/narrativex_worker/visual_timing.py` — obsolete duration-weighted visual clock, beat expansion, and image reuse grouping.
- `app/ai-worker/tests/test_visual_timing.py` — tests only the obsolete module above.

### Simplify

- `app/ai-worker/src/narrativex_worker/visual_alignment.py` — retain only ordered exact source-anchor resolution and UTF-16 offset conversion.
- `app/ai-worker/tests/test_visual_alignment.py` — retain only source-anchor resolver regressions.

### Update documentation

- `docs/superpowers/specs/2026-08-31-visual-beat-audio-alignment-design.md` — final architecture: worker resolves text ranges; backend maps ranges to audio.
- `docs/superpowers/plans/2026-08-31-visual-beat-audio-alignment.md` — remove stale Python audio-mapping claims and refresh verification wording.
- `docs/superpowers/specs/2026-08-31-visual-timing-cleanup-design.md` — retained as cleanup decision record; update only if implementation discovers a contradiction.
- PR #406 body — summarize final single-authority design and cleanup result after verification.

### Explicitly unchanged compatibility files

- `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/port/in/MediaPlanningSource.java`
- `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/service/MediaPlanningSourceService.java`
- `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaPlanUseCase.java`
- database schema/migrations for `visual_beats.audio_start_ms/audio_end_ms`

---

### Task 1: Remove the obsolete duration-weighted visual timing module

**Files:**
- Delete: `app/ai-worker/src/narrativex_worker/visual_timing.py`
- Delete: `app/ai-worker/tests/test_visual_timing.py`

**Interfaces:**
- Consumes: repository-wide proof that `visual_timing`, `normalize_visual_timing`, `VisualTimingPolicy`, `SemanticBeat`, and `TimedVisualBeat` have no production consumer.
- Produces: no duration-weighted/beat-expansion timing implementation in the AI worker.

- [ ] **Step 1: Reconfirm there is no production consumer before deletion**

Run repository searches for these exact symbols:

```text
visual_timing
normalize_visual_timing
VisualTimingPolicy
SemanticBeat
TimedVisualBeat
```

Expected before deletion: matches are limited to `visual_timing.py` and `test_visual_timing.py`; no file under production code imports the module.

- [ ] **Step 2: Delete the obsolete module and its dedicated test**

Delete exactly:

```text
app/ai-worker/src/narrativex_worker/visual_timing.py
app/ai-worker/tests/test_visual_timing.py
```

Do not transplant `_expand()` or `_allocate_durations()` elsewhere. Their duration-weighted behavior is intentionally retired.

- [ ] **Step 3: Run AI-worker tests to expose any hidden import**

Run from `app/ai-worker`:

```bash
python -m pytest
```

Expected: PASS. A `ModuleNotFoundError` for `narrativex_worker.visual_timing` means a hidden consumer exists and must be evaluated before proceeding.

- [ ] **Step 4: Run static checks**

```bash
python -m ruff check src tests
python -m mypy src
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A app/ai-worker/src/narrativex_worker/visual_timing.py app/ai-worker/tests/test_visual_timing.py
git commit -m "refactor: remove legacy visual timing policy"
```

---

### Task 2: Reduce `visual_alignment.py` to source-anchor resolution only

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/visual_alignment.py`
- Modify: `app/ai-worker/tests/test_visual_alignment.py`
- Verify unchanged production consumer: `app/ai-worker/src/narrativex_worker/materialization/storyboard.py`
- Verify replacement authority: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/service/NarrationTextClockMapper.java`

**Interfaces:**
- Consumes: `codepoint_to_utf16_offset(source_text: str, codepoint_index: int) -> int` from narration segmenter.
- Produces: `resolve_visual_beat_ranges(source_text: str, anchors: Sequence[str]) -> list[ResolvedVisualBeatRange]` and `ResolvedVisualBeatRange(text_start: int, text_end: int)` only.

- [ ] **Step 1: Lock the surviving behavior with focused resolver tests**

The final `test_visual_alignment.py` must retain these four behaviors:

```python
def test_resolve_visual_beat_ranges_uses_ordered_exact_utf16_offsets() -> None:
    ...


def test_resolve_visual_beat_ranges_uses_next_occurrence_for_repeated_anchor() -> None:
    ...


def test_resolve_visual_beat_ranges_rejects_missing_or_out_of_order_anchor() -> None:
    ...


def test_resolve_visual_beat_ranges_rejects_blank_anchor() -> None:
    with pytest.raises(ValueError, match="source anchor must not be blank"):
        resolve_visual_beat_ranges("Một. Hai.", ["   "])
```

Add the blank-anchor regression before removing unrelated mapping tests so the remaining module has explicit input validation coverage.

- [ ] **Step 2: Run the focused test before refactoring**

```bash
python -m pytest tests/test_visual_alignment.py -q
```

Expected: existing resolver tests PASS and the newly added blank-anchor test PASS against current behavior.

- [ ] **Step 3: Remove Python text-to-audio mapping implementation**

Delete these imports/symbols from `visual_alignment.py`:

```python
from fractions import Fraction
from narrativex_worker.narration.models import AlignmentSpan

@dataclass(frozen=True, slots=True)
class VisualAudioRange:
    audio_start_ms: int
    audio_end_ms: int


def _map_text_offset_to_audio(...):
    ...


def map_visual_ranges_to_audio(...):
    ...
```

The final module must contain only:

```python
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from narrativex_worker.narration.segmenter import codepoint_to_utf16_offset


@dataclass(frozen=True, slots=True)
class ResolvedVisualBeatRange:
    text_start: int
    text_end: int


def resolve_visual_beat_ranges(
    source_text: str,
    anchors: Sequence[str],
) -> list[ResolvedVisualBeatRange]:
    ...
```

Preserve the existing ordered exact matching semantics and UTF-16 conversion unchanged.

- [ ] **Step 4: Delete superseded Python audio-mapping tests**

Remove these tests and imports from `test_visual_alignment.py`:

```python
from narrativex_worker.narration.models import AlignmentSpan
VisualAudioRange
map_visual_ranges_to_audio

def test_map_visual_ranges_to_audio_builds_gap_free_audio_clock() -> None:
    ...

def test_map_visual_ranges_to_audio_rejects_duplicate_transition_points() -> None:
    ...
```

Do not replace them with another Python audio-mapping test. Backend `NarrationTextClockMapperTest` is the authoritative regression for that responsibility.

- [ ] **Step 5: Run focused and full AI-worker verification**

```bash
python -m pytest tests/test_visual_alignment.py -q
python -m pytest
python -m ruff check src tests
python -m mypy src
```

Expected: all PASS.

- [ ] **Step 6: Re-run repository symbol search**

Search for:

```text
VisualAudioRange
map_visual_ranges_to_audio
_map_text_offset_to_audio
```

Expected: zero production references; ideally zero repository references after cleanup.

- [ ] **Step 7: Commit**

```bash
git add app/ai-worker/src/narrativex_worker/visual_alignment.py app/ai-worker/tests/test_visual_alignment.py
git commit -m "refactor: keep visual alignment source-anchored"
```

---

### Task 3: Synchronize timing documentation with the final authority split

**Files:**
- Modify: `docs/superpowers/specs/2026-08-31-visual-beat-audio-alignment-design.md`
- Modify: `docs/superpowers/plans/2026-08-31-visual-beat-audio-alignment.md`
- Verify: `docs/superpowers/specs/2026-08-31-visual-timing-cleanup-design.md`

**Interfaces:**
- Consumes: final code responsibilities after Tasks 1-2.
- Produces: documentation that describes only implemented/current architecture, not superseded intermediate designs.

- [ ] **Step 1: Remove stale claims from the original visual-beat timing plan**

Replace any checklist item that says the AI worker owns text-range-to-audio mapping, such as:

```markdown
- [x] Add deterministic text-range-to-audio mapping tests.
```

with wording that identifies the backend authority:

```markdown
- [x] Add deterministic backend source-range-to-audio mapping through `NarrationTextClockMapper`.
- [x] Remove the superseded Python visual audio mapper after the backend on-read path became authoritative.
```

- [ ] **Step 2: Add an explicit final responsibility table to the design**

Add this compact table to the design document:

```markdown
| Layer | Timing responsibility |
| --- | --- |
| AI worker | Resolve verbatim `source_anchor` to UTF-16 `text_start/text_end` |
| Narration worker | Build and normalize narration alignment to encoded audio duration |
| Backend Production Timeline | Map visual text starts through narration alignment into a contiguous image clock |
| Media plan compatibility | Preserve existing persisted beat audio fields while they still have consumers |
```

Remove any wording that implies the Python AI worker also owns production visual audio mapping.

- [ ] **Step 3: Record the retired implementation explicitly**

Add a short migration note:

```markdown
## Retired timing path

The former `visual_timing.py` duration-weighted expansion policy and the Python visual text-to-audio mapper were removed after the source-anchored/on-read backend path became authoritative. They must not be reintroduced as fallback timing because they can produce a valid-looking clock without source provenance.
```

- [ ] **Step 4: Keep verification wording truthful**

Before final CI, describe verification as pending on the cleanup head. Do not mark Backend/AI/Desktop/Repository gates complete until the exact cleanup head has passed.

- [ ] **Step 5: Run documentation drift gate**

From repository root:

```bash
python scripts/check-docs-drift.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-08-31-visual-beat-audio-alignment-design.md docs/superpowers/plans/2026-08-31-visual-beat-audio-alignment.md docs/superpowers/specs/2026-08-31-visual-timing-cleanup-design.md
git commit -m "docs: align visual timing docs with migration"
```

---

### Task 4: Verify compatibility paths and exact final CI head

**Files:**
- Verify unchanged: `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/port/in/MediaPlanningSource.java`
- Verify unchanged: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaPlanUseCase.java`
- Verify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/service/NarrationTextClockMapper.java`
- Verify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: cleaned implementation and synchronized docs.
- Produces: evidence that no compatibility consumer was broken and the exact final head is green.

- [ ] **Step 1: Confirm kept timing fields still have consumers**

Repository search must still show `audioStartMs()` / `audioEndMs()` use in `CreateMediaPlanUseCase`, including this duration derivation:

```java
beat.audioStartMs() != null && beat.audioEndMs() != null
    ? beat.audioEndMs() - beat.audioStartMs()
    : null
```

This is evidence that removing those fields is deliberately deferred.

- [ ] **Step 2: Run backend verification locally when available**

From `app/backend-service`:

```bash
./mvnw --batch-mode --no-transfer-progress verify
```

Expected: PASS under Java 25. If local Java 25 is unavailable, rely on the GitHub Actions `Backend verify` job and do not claim local success.

- [ ] **Step 3: Run repository gates locally**

From repository root:

```bash
python scripts/check-secrets.py
python scripts/check-docs-drift.py
docker compose config --no-interpolate >/dev/null
```

Expected: PASS.

- [ ] **Step 4: Run Desktop verification**

From `app/desktop`:

```bash
npm ci
npm run check
```

Expected: PASS.

- [ ] **Step 5: Push final head and inspect GitHub Actions for that exact SHA**

The CI workflow requires all four jobs:

```text
Repository gates
Backend verify
AI worker checks
Desktop check
```

Within AI worker checks, confirm all three steps pass:

```text
Tests
Ruff
Mypy
```

Do not use a prior code-equivalent run as final proof. Verification must be for the exact final cleanup SHA.

- [ ] **Step 6: If a CI job fails, diagnose before changing code**

For the failing job, inspect the exact failed step/log and classify it as:

```text
cleanup regression
pre-existing/baseline failure
environment/transient failure
```

Only change production code for a demonstrated cleanup regression. Do not weaken tests, formatting, coverage, or admission rules to make CI green.

- [ ] **Step 7: Commit any verification-only doc status update after green CI only if necessary**

If the implementation plan records final CI status, update it with the final run number/SHA and commit:

```bash
git add docs/superpowers/plans/2026-08-31-visual-beat-audio-alignment.md
git commit -m "docs: record visual timing cleanup verification"
```

If this creates a new commit, that new SHA must itself be verified; otherwise leave transient run identifiers out of the committed doc and put them only in the PR body/comment.

---

### Task 5: Update PR #406 to describe the cleaned final architecture

**Files:**
- GitHub PR metadata only: PR #406

**Interfaces:**
- Consumes: exact final implementation, docs, and CI results.
- Produces: review-ready PR description with no stale intermediate design claims.

- [ ] **Step 1: Update the PR summary after cleanup**

The body must include these final facts:

```markdown
- narration audio is the authoritative clock;
- cumulative PCM-frame timing removes per-segment rounding accumulation;
- encoded MP3 duration normalization removes bounded final tail drift;
- visual beats carry verbatim source provenance resolved to UTF-16 text ranges;
- backend Production Timeline maps those ranges through narration alignment on read;
- obsolete duration-weighted `visual_timing.py` and Python visual-audio mapping were removed;
- persisted beat audio timing remains supported for compatibility when already complete;
- true word/phoneme forced alignment remains a future precision improvement.
```

- [ ] **Step 2: Record exact verification status**

Only after the exact final head is green, state:

```markdown
## Verification
- Repository gates: pass
- Backend verify: pass
- AI worker tests/Ruff/Mypy: pass
- Desktop check: pass
```

If any job is still failing, name it explicitly instead of calling the PR ready.

- [ ] **Step 3: Final dead-code search**

Search the repository for:

```text
normalize_visual_timing
VisualTimingPolicy
SemanticBeat
TimedVisualBeat
VisualAudioRange
map_visual_ranges_to_audio
```

Expected: no production references. `visual_timing.py` and its test must not exist.

- [ ] **Step 4: Final review checkpoint**

Confirm the PR diff does not include:

```text
new database migrations
removal of MediaPlanningSource audio timing fields
forced-alignment dependencies
unrelated FE/BE refactors
```

If all checks pass, the cleanup is complete and PR #406 can be considered ready for the next review/merge decision.
