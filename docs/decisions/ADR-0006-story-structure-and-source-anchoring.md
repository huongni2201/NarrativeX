# ADR-0006: Story structure — StoryBeat hierarchy, source anchoring and fail-closed materialization

- **Status:** Accepted
- **Date:** 2026-10-15 (consolidated)
- **Replaces:** former ADR-0024 and the older storyboard/character workflow, transactional chapter creation, source-anchored timing and continuity/selective-regeneration decisions (Git history)

## Context

Earlier pipelines decomposed a chapter into Scenes and VisualBeats while narration was planned separately. The two AI readings drifted apart, VisualBeats had no shared semantic parent, copied AI text altered dialogue and clues, and per-beat audio synthesis broke prosody and timing.

## Decision

### Hierarchy

1. Story structure is `Project → StoryVersion → Chapter → Scene → StoryBeat → {AudioCue[], VisualBeat[]}`. A StoryBeat is one coherent dramatic event. It owns ordered AudioCues (what is heard) and groups VisualBeats (what is seen).
2. Character is a reusable identity. A Project uses it through `ProjectCharacter`. Appearance and outfit changes never create a new Character, and `CharacterVersion` is an immutable snapshot. Chapter and StoryBeat context resolves only participating characters. Scenes may link to a `ProjectLocation`.

### Analysis output (model-neutral)

3. Chapter Analysis (executed per ADR-0009) proposes, for each StoryBeat, AudioCues with an adaptation action (`KEEP_EXACT`, `LIGHT_EDIT`, `COMPRESS`, `VISUAL_PRIMARY`), VisualBeats with focus and relative weight, and Character and Location references. The user-selected adaptation mode (`AUTO`, `FAITHFUL`, `BALANCED`, `CINEMATIC`) steers it. Genre rules are not hard-coded in Java.
   - Materialization stores the normalized `dramatic_intent` category in `StoryBeat.purpose` (default `SETUP`). The full prose `visual_intent` stays on VisualBeat; it must not be copied into the 64-character purpose category.

### Source authority and validation

4. `Chapter.sourceText` is immutable once saved. Workflows pin `chapterId`, `storyVersion` and `sourceHash`.
5. Every StoryBeat, AudioCue and VisualBeat carries UTF-16 source offsets. For `KEEP_EXACT` cues the backend derives text from `source.substring(start, end)` and discards model-copied text.
   - **Unit anchoring (analysis contract 1.2).** The model never copies source text to say where something is. The backend splits the normalized chapter into numbered, trimmed, ordered source units with a deterministic, versioned segmenter (`SourceUnitSegmenter`, sentences and clauses, hard line boundaries, at most 100 characters per unit so no unit exceeds the 10 s VisualBeat limit). The Desktop receives `units: [{i, len, text}]`; the model returns `start_unit` per VisualBeat and `start_unit`/`end_unit` (inclusive) per AudioCue. The backend validates the integers (in range, strictly increasing across beats, cues inside their beat and in order) and derives `textStart/textEnd` itself. VisualBeats tile the chapter: a beat runs to the unit before the next beat, and the first beat starts at unit 0, which matches the production clock (only each beat's start is mapped through alignment).
   - Earlier contract 1.1 asked for exact verbatim `source_anchor` quotes and rejected the whole analysis on any copy deviation (a paraphrase, a dropped word or an altered quote). That failure class no longer exists. Changing the segmenter requires a new `SourceUnitSegmenter.VERSION` together with the prompt and schema version.
6. Spring Boot validates before any write, and fails closed: bounds and monotonic order, full non-whitespace coverage by StoryBeats, strict nesting (cue and VisualBeat inside StoryBeat, StoryBeat inside Scene), and resolution of character and location names to stable entities.
7. Materialization is fenced to the saved source revision. Canon, story structure, cues and job completion commit in one transaction. Invalid, stale or partial output never replaces persisted story state.

### Chapter transactions

8. Creating a Project persists metadata only. Creating a Chapter resolves or creates its StoryVersion and Chapter in one backend transaction with an idempotency key and request fingerprint. Clients do not orchestrate StoryVersion creation. Saving source never triggers AI work implicitly.

### Narration assembly and timing

9. Audio is never synthesized per VisualBeat. `NarrationScript` assembles ordered AudioCues into one chapter script with per-cue text offsets, and it is bound to an immutable script ID and content hash. Synthesis and alignment follow ADR-0007.
10. Alignment word timings map back to AudioCue windows and StoryBeat spans. VisualBeats in a StoryBeat get contiguous, non-overlapping windows by `relativeWeight`. VisualBeat source anchors are mapped through alignment when the production timeline is built. Persisted or provisional times are never render-admission inputs.

### Retired state

11. Continuity review reports, continuity and selective-regeneration plans, StoryBeat continuity JSON and shard-based analysis checkpoints are not part of the schema or API. Re-analysis creates new revisions and does not add a chapter-wide regeneration subsystem.

## Invariants

1. Source text is the only truth for exact dialogue, names and clues.
2. No partial materialization: either the whole validated analysis commits, or nothing changes.
3. Legacy or manual VisualBeats without a StoryBeat (`story_beat_id` is null) remain a compatibility path. New canonical planning always attaches VisualBeats to StoryBeats.

## Consequences

- Narration and visuals share one interpretation, and exact dialogue cannot be hallucinated.
- The backend carries substantial validation logic. Analysis schema changes require coordinated prompt, schema and validator updates.

## Related

- [ADR-0007](ADR-0007-narration-tts-and-alignment.md) · [ADR-0008](ADR-0008-video-first-shot-production.md) · [ADR-0009](ADR-0009-chapter-analysis-agy-cli.md) · [Domain model](../domain/domain-model.md)
