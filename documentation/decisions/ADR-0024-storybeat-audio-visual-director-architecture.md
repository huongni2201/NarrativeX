# ADR-0024: StoryBeat Audio + Visual Director Architecture

**Implementation status:** foundation implemented; legacy/manual VisualBeat rows without a StoryBeat remain a compatibility path.

## Status

Accepted (2026-09-18)

## Context

In previous iterations, Chapter Analysis decomposed chapter source text directly into Scene and
VisualBeat entities, while narration synthesis and audio alignment were handled as semi-independent
pipelines. This led to several fundamental architectural issues:
1. Narration and visual planning were two independent AI interpretations of the same chapter, causing narrative desynchronization.
2. VisualBeats lacked a shared semantic parent representing a single dramatic or narrative beat, leading to either arbitrary 1:1 beat-to-sentence splits or rigid 5-second placeholder timings.
3. Copied AI text in analysis outputs risked hallucinations, missed clues, altered character voices, and subtle worldbuilding drift when trying to preserve exact dialogue.
4. Synthesizing audio per-VisualBeat or directly from unstructured chapter text prevented natural prosody, coherent pacing, and precise reverse-mapping of audio timestamps to individual visual moments.

## Decision

1. **Domain Hierarchy — StoryBeat as Semantic Parent**:
   Decompose chapters into:
   ```text
   Project -> StoryVersion -> Chapter -> Scene -> StoryBeat -> {AudioCue[], VisualBeat[]}
   ```
   A `StoryBeat` represents one coherent semantic or dramatic event. It owns ordered `AudioCue` records (what the audience hears) and canonically groups `VisualBeat` records (what the audience sees). Legacy/manual VisualBeat rows may remain unassigned until migrated.

2. **Gemini 3.8 Flash (Thinking HIGH) as Story Director**:
   Gemini acts as the executive Story Director. For each `StoryBeat`, Gemini determines:
   - What the audience should hear (`AudioCue` entries: narrator, dialogue, inner monologue, system cues).
   - What the audience should see (`VisualBeat` entries: speaker, listener reaction, two-shot, environment establishing, cutaway).
   - The adaptation action per audio cue (`KEEP_EXACT`, `LIGHT_EDIT`, `COMPRESS`, `VISUAL_PRIMARY`).
   - The relative visual duration weights across multiple `VisualBeat` entries within the same `StoryBeat`.
   - Adaptation is configured by user-selected modes (`AUTO`, `FAITHFUL`, `BALANCED`, `CINEMATIC`) without hardcoding genre rule engines in Java.

3. **Source Text Immutability & KEEP_EXACT Rule**:
   `Chapter.sourceText` remains the immutable source of truth.
   Every `StoryBeat`, `AudioCue`, and `VisualBeat` maps to valid UTF-16 code-unit offsets (`sourceStart`, `sourceEnd`).
   When an `AudioCue` is marked `KEEP_EXACT`, the backend strictly derives its text from `chapterSource.substring(sourceStart, sourceEnd)`. LLM-generated copied text is discarded to preserve exact dialogue, clues, names, and worldbuilding rules.

4. **Spring Boot Validation Authority (Fail-Closed)**:
   Spring Boot validates all plans before persistence:
   - UTF-16 bounds and strict monotonic ordering.
   - Non-whitespace source coverage: the entire chapter source must be accounted for by StoryBeats.
   - Entity reference reconciliation: AI character and location names must resolve to stable ProjectCharacter and ProjectLocation entities.
   - Hierarchical containment: `AudioCue` and `VisualBeat` ranges must nest strictly inside their parent `StoryBeat` range, and `StoryBeat` ranges inside their parent `Scene`.

5. **Assembled Narration Pipeline (`NarrationScript`)**:
   Do not synthesize audio per VisualBeat.
   `NarrationAssembler` compiles ordered `AudioCue` entries into a single, cohesive chapter `NarrationScript`, recording exact `narrationTextStart` and `narrationTextEnd` character offsets for each cue.
   Production TTS (`VieNeu`) synthesizes the approved `NarrationScript.text` bound to an immutable script ID and content hash.

6. **WhisperX Reverse Timing & Contiguous Visual Windows**:
   WhisperX aligns the generated WAV against `NarrationScript.text`.
   `NarrationCueTimingMapper` maps word timestamps back to `AudioCue` audio windows (`audioStartMs`, `audioEndMs`) and determines the `StoryBeat` audio duration (`startMs`, `endMs`).
   VisualBeats inside each StoryBeat derive contiguous, non-overlapping visual display windows based on their `relativeWeight`.

7. **Prompt Compilation & Domain-Neutral Compute**:
   `VisualBeatPromptCompiler` compiles production prompts from StoryBeat intent, visual focus, CharacterVersion snapshots, Location descriptions, and project style tokens. Placeholder prompts are removed from production workflows.
   `app/generation-service` remains a domain-neutral compute execution plane with no database access. Final MP4 render remains local in Desktop via Electron and FFmpeg. Video generation models remain out-of-scope.

## Consequences

- Creative decisions (what to hear, what to see, pacing) are unified under Gemini 3.8 Flash Story Director.
- Deterministic Spring Boot validation and exact source slicing ensure data integrity and zero hallucination on exact dialogue.
- Spoken narration flows naturally as a single script while retaining micro-alignment to visual beats.
- Database schema gains `story_beats`, `audio_cues`, and `narration_scripts` tables; `visual_beats` gains `story_beat_id`, `relative_weight`, and `visual_focus`.
