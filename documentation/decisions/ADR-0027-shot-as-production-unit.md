# ADR-0027: Shot as the Atomic Production Unit

## Status

Accepted

## Context

In the previous design, `VisualBeat` attempted to satisfy two conflicting concerns:
1. Dramatic / narrative beat planning (intent, summary, focus, dialogue pairing).
2. Media production and rendering (asset pointer, motion type, camera override, duration).

This coupling caused architectural friction:
- A single dramatic beat often requires multiple camera angles (e.g., establishing wide shot, actor medium reaction, close-up on an object).
- Generation retries, cost tracking, quality assurance, and asset state machines could not operate at the sub-beat level.

## Decision

1. **Refactor VisualBeat into a Dramatic Beat**:
   `VisualBeat` becomes purely a semantic and dramatic container owned by Scene and StoryBeat. It holds:
   - `dramaticIntent` (SETUP, QUESTION, TENSION, ESCALATION, REVEAL, REACTION, PAYOFF, RELIEF, TRANSITION, CLIFFHANGER)
   - `emotion` (emotional valence)
   - `retentionRole` (HOOK, INCITING, CLIMAX, etc.)
   - `startTimeHint` / `durationHint`
   - Pointer to a `ShotSequence`.

2. **Establish Shot as the Atomic Production Unit**:
   The `Shot` entity becomes the exclusive atomic boundary for:
   - Visual specification (`subjects`, `locationRef`, `startState`, `action`, `endState`, `composition`, `camera`, `subjectMotion`, `cameraMotion`, `environmentMotion`).
   - Generation strategy assignment (`T2V`, `I2V`, `FIRST_LAST_FRAME`, `MULTI_KEYFRAME`, `VIDEO_EXTEND`, `VIDEO_RETAKE`).
   - GPU compute admission, leasing, execution, and retry counts.
   - Quality assurance validation and failure tracking.
   - Multi-take holding and selection.

3. **Temporal Progression Invariant**:
   Every `Shot` must define explicit temporal change between `startState` and `endState`. Static holding shots where `startState == endState` are rejected during planning unless marked with an intentional narrative hold flag.

## Consequences

- Story and Scene planners decompose beats into `ShotSequence` containing 1..N `Shot` instances.
- Database schema introduces `shot_sequences` and `shots` tables.
- Desktop UI navigates and reviews at the shot level.
