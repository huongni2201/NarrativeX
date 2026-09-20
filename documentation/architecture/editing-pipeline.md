# Editing Pipeline & Timeline Assembly Architecture

**Status:** Authoritative Editing Specification  
**Authority:** ADR-0026, ADR-0030  
**Date:** 2026-09-20  

---

## 1. Overview

In the video-first pipeline, video editing is distinct from video generation. Generative models produce takes of fixed or estimated durations (e.g. 5 seconds), whereas storytelling requires precise rhythm, cuts on action, dialogue pacing, and audio alignment.

The `EditingDirector` compiles an immutable `EditDecisionList` (EDL) from `SelectedTake` entities and the master narration clock (VieNeu).

---

## 2. EditDecisionList (EDL) Contract

```typescript
interface EditDecisionList {
  schemaVersion: "1.0";
  projectId: string;
  storyVersionId: string;
  chapterId: string;
  totalDurationMs: number;
  fps: 24;
  resolution: { width: 1280; height: 720 };
  audioClockSource: "VIENEU_MASTER" | "SCRIPTLOCK";
  audioAssetId: string;
  decisions: EditDecision[];
  subtitles: SubtitleCue[];
}

interface EditDecision {
  decisionId: string;
  orderIndex: number;
  shotId: string;
  takeId: string;
  mediaAssetId: string;
  sourceInMs: number;
  sourceOutMs: number;
  timelineInMs: number;
  timelineOutMs: number;
  transition?: {
    type: "CUT" | "DISSOLVE" | "FADE_BLACK";
    durationMs: number;
  };
}
```

---

## 3. Editing Principles

1. **Clip Duration != Edit Duration**: A generated take with `sourceDurationMs = 5000` may have `sourceInMs = 500` and `sourceOutMs = 3200`, creating an edit span of 2700 ms. The in/out window can be adjusted automatically by the `EditingDirector` or manually trimmed in the Desktop UI.
2. **Audio Clock as Master**: Narration audio duration is authoritative. Shot transitions align to natural sentence boundaries, dramatic pauses, or dramatic beat transitions.
3. **No Synthetic Zoompan**: Moving video footage is scaled and padded to 1280x720 at 24 FPS; no FFmpeg Ken Burns zoom/pan filter is applied to moving video clips.
4. **Transition Continuity**: Intra-scene cuts are hard cuts by default. Scene and chapter boundaries may receive subtle fades or dissolves specified in the EDL.
