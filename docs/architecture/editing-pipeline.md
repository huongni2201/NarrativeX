# Editing Pipeline & Timeline Assembly Architecture

**Status:** maintained implementation contract; advanced EDL remains TARGET

**Authority:** code, tests, ADR-0008

**Reviewed:** 2026-10-12

---

## 1. Overview

In the video-first pipeline, video editing is distinct from video generation. Generative models produce takes of fixed or estimated durations (e.g. 5 seconds), whereas storytelling requires precise rhythm, cuts on action, dialogue pacing, and audio alignment.

The backend captures ordered `SelectedTake` cuts in an immutable render input snapshot. For `NATIVE_TAKE`, source duration and approved In/Out define edit duration; Electron trims video and source audio together. `EXTERNAL_NARRATION` uses the explicit narration timeline. VieNeu is not an implicit timing fallback for native takes.

**IMPLEMENTED source contract:** The V4 baseline adds ordered cut identity, shot/take references, source duration, trim and observed subtitle fields to render snapshots. Native profiles use schema 4 (`project-native-av-v4`); schema 3 profiles retain the legacy renderer and external narration. Profile subtitle style is immutable. Desktop preserves explicit 24/30/60 FPS and verifies probed dimensions/FPS on completion and recovery. Native cuts are hard cuts so video and source audio share the same boundaries. Caption timing must be observed; the current native finalizer does not populate it.

Local multi-shot FFmpeg fixtures verify local composition only. These checks do not prove production GPU output, advanced transitions or a complete creator journey.

---

## 2. EditDecisionList (EDL) Contract

**TARGET:** The following EDL is a narration-oriented design contract under ADR-0008, not the active schema-4 render profile or a shipped EDL export endpoint. Native assembly currently uses the frozen snapshot described above; dissolve/fade compilation and advanced multi-track mixing remain TARGET.

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

1. **Clip Duration != Edit Duration**: A generated take with `sourceDurationMs = 5000` may have `sourceInMs = 500` and `sourceOutMs = 3200`, creating an edit span of 2700 ms. The in/out window can be trimmed manually in the Desktop UI (automatic edit direction is not part of the current architecture; it would need its own ADR, see ADR-0008).
2. **Explicit Audio Authority**: Native source audio follows the selected take's In/Out. Narration duration is authoritative only in explicit narration mode; provisional timing cannot make either mode render ready.
3. **No Synthetic Zoompan**: Moving video footage is scaled and padded to 1280x720 at 24 FPS; no FFmpeg Ken Burns zoom/pan filter is applied to moving video clips.
4. **Transition Continuity**: Native cuts are currently hard cuts. Legacy profiles preserve their existing fades. Advanced scene/chapter dissolves and matching audio transitions are TARGET EDL work.
