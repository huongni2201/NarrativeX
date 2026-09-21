# Story Domain Model

**Status:** Authoritative Domain Specification  
**Authority:** ADR-0024, ADR-0027  
**Date:** 2026-09-20  

---

## 1. Hierarchy

```text
Project
  └── StoryVersion
        └── Chapter
              └── Scene
                    └── StoryBeat
                          ├── AudioCue[] (Dialogue, Narration, Sound Cues)
                          └── VisualBeat (Dramatic Beat)
                                └── ShotSequence
                                      └── Shot[]
```

---

## 2. VisualBeat as Dramatic Beat

In the video-first architecture, a `VisualBeat` no longer equals a single still image or generation job. It represents a coherent dramatic unit within a Scene.

### Fields
- `id`: UUID (UUIDv7)
- `sceneId`: UUID
- `storyBeatId`: UUID (Nullable for legacy compatibility, required for canonical new projects)
- `orderIndex`: Integer
- `title`: String
- `summary`: String
- `dramaticIntent`: Enum
  - `SETUP`: Setting spatial or psychological baseline.
  - `QUESTION`: Raising an unresolved curiosity hook.
  - `TENSION`: Escalating danger, conflict, or uncertainty.
  - `ESCALATION`: Intensifying stakes or pace.
  - `REVEAL`: Unveiling withheld information.
  - `REACTION`: Capturing character emotional response.
  - `PAYOFF`: Delivering the answer or emotional climax.
  - `RELIEF`: Temporary release of tension.
  - `TRANSITION`: Passage of time or movement to new space.
  - `CLIFFHANGER`: Ending on peak unresolved stakes.
- `emotion`: String (Dominant emotional valence, e.g., "dread", "anticipation")
- `retentionRole`: `RetentionRole` enum (Nullable)
- `startTimeHint`: Integer (provisional ms)
- `durationHint`: Integer (provisional ms)
- `shotSequenceId`: UUID
