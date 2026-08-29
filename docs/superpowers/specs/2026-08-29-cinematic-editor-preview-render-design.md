# Cinematic Editor Preview, Subtitle, and Render Design

## Goal

Upgrade NarrativeX Editor so preview audio is reliable, visual editing is less static, transitions and subtitles are represented in both preview and final render, and the user can render from Editor while choosing the destination folder for the final video.

## Scope

This design covers five connected behaviors:

1. narration-driven preview playback;
2. richer Auto Edit motion and transition planning;
3. subtitle timeline + preview + final burn-in;
4. Render action exposed directly from Editor;
5. destination-folder selection before final render.

The final output must preserve the narration timeline as the master clock. Preview and FFmpeg render must consume the same edit decisions wherever practical so the Editor is a trustworthy preview of the final video.

## Current Constraints

- `EditorPlaybackSurface` owns the global playhead and currently advances it with a timer.
- `EditorPreviewViewport` receives one narration URL at a time and attempts to synchronize `<audio>` to the timer-driven playhead.
- `AutoEditBeatDecision` currently contains only camera movement, fit mode, and trim start.
- The renderer currently plans CUT for regular beat boundaries and FADE_BLACK at chapter boundaries.
- The existing `RenderScreen` already performs readiness checks, local preflight, render job creation, progress tracking, and output reveal.
- Local render is FFmpeg-based and narration timing is authoritative.
- The backend render request currently accepts only `720p|1080p`; 2K support therefore requires an end-to-end contract update rather than a UI-only option.

## Architecture

### 1. Playback clock

Create a playback controller that treats narration audio as the authoritative wall clock while playback is active. The controller exposes the current global playhead to the existing timeline and viewport components.

For the currently active chapter:

- local chapter time = `globalPlayheadMs - chapter.startMs`;
- `<audio>.currentTime` drives global playhead while playing;
- timeline seek updates the audio current time;
- pause stops the audio and freezes the global playhead;
- when the playhead crosses a chapter boundary, load the next narration source, seek to the equivalent local offset, then continue playback.

A light `requestAnimationFrame` loop reads audio current time for smooth UI updates; it does not invent elapsed time independently from audio.

### 2. Auto Edit V2

Extend edit decisions with duration-preserving presentation metadata:

```ts
type BeatTransitionType = "CUT" | "CROSS_DISSOLVE" | "DIP_BLACK";
type MotionEasing = "LINEAR" | "EASE_IN_OUT";

interface AutoEditBeatDecision {
  visualBeatId: string;
  cameraMovement: string;
  fitMode: BeatMediaFitMode;
  trimStartMs: number;
  motionIntensity: number;
  motionEasing: MotionEasing;
  transitionOut: BeatTransitionType;
  transitionDurationMs: number;
  source: "AI_DIRECTED" | "RULE_ENGINE";
  reason: string;
}
```

Rules remain deterministic:

- action/dynamic beats prefer CUT and stronger movement;
- ordinary scene changes may use short CROSS_DISSOLVE;
- chapter boundaries use DIP_BLACK;
- transition duration is clamped to a safe fraction of adjacent beat duration;
- transitions do not change narration duration or beat start/end offsets.

Preview must read these decisions. The FFmpeg render path must consume the same transition type/duration values rather than having a separate hard-coded transition policy.

### 3. Subtitle model

Subtitles are derived from narration text and narration alignment, not from Visual Beat title or visual intent.

The Editor consumes subtitle cues in the form:

```ts
interface DesktopSubtitleCue {
  id: string;
  chapterId: string;
  startMs: number;
  endMs: number;
  text: string;
}
```

Requirements:

- cue offsets are global project offsets;
- cues must stay within their chapter narration span;
- cues are shown as a separate timeline track;
- the active cue is rendered as an overlay in preview;
- final render burns the same cue text/timing into the video;
- subtitle visibility is optional at render time, default ON.

If precise word alignment is not available, deterministic sentence/phrase segmentation may distribute cues over the existing narration span, but the implementation must keep this derivation isolated so later true TTS alignment can replace it without changing Editor/renderer contracts.

### 4. Render controller shared by Editor and Render page

Extract the existing RenderScreen orchestration into a shared hook/controller responsible for:

- readiness blockers;
- Auto Edit plan creation;
- local preflight;
- starting render;
- progress tracking;
- completion/failure status.

`RenderScreen` and `EditorScreen` call the same controller. Editor gains a primary `Render` button and a compact render dialog instead of duplicating render business logic.

### 5. Destination folder selection

Rendering from the desktop must prompt for an output directory before the render job is queued.

Flow:

1. user clicks `Render`;
2. render dialog confirms resolution, Auto Edit style, subtitle toggle;
3. user clicks `Choose folder & render`;
4. Electron main process opens `dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })`;
5. cancellation exits without creating a render job;
6. selected path is returned through a trusted preload IPC API;
7. render request includes the chosen destination directory;
8. the local renderer writes/copies the final completed MP4 into that directory using a sanitized deterministic filename;
9. job completion exposes the final path and `Open output` reveals that user-selected file.

The renderer must never accept an arbitrary path directly from untrusted renderer JavaScript without passing through the trusted folder-picker IPC flow. The selected directory is user-authorized for that render action.

Default final filename:

```text
<narrativex-project-name>-<yyyyMMdd-HHmmss>.mp4
```

If project name is unavailable, use `narrativex-render-<yyyyMMdd-HHmmss>.mp4`.

Existing internal render working directories/journals remain unchanged. The user destination is the final delivery target, not a replacement for temporary render workspace.

### 6. Render resolution contract

Expose three render quality presets end-to-end:

```ts
type RenderResolution = "720p" | "1080p" | "1440p";
```

UI labels:

- `720p · HD`
- `1080p · Full HD`
- `2K · 1440p (QHD)`

For a 16:9 project the concrete output sizes are:

- `720p` -> `1280x720`
- `1080p` -> `1920x1080`
- `1440p` -> `2560x1440`

For portrait or other supported aspect ratios, preserve the project aspect ratio and use the selected preset as the target short-edge class rather than stretching the frame. The implementation must keep width and height even so FFmpeg/H.264 encoders remain valid.

In this design, the product label **2K** means **QHD 2560x1440**, not DCI 2K 2048x1080. This matches the common desktop/video-export expectation and keeps the existing 720p -> 1080p -> 1440p quality ladder consistent.

Required contract changes include the backend request validation, desktop/client render types, renderer output-size resolver, UI selector, tests, and any render snapshot metadata that restricts resolution values.

## UI

### Editor toolbar

Add a primary `Render` button in the Editor top/right action area.

### Render dialog

Fields:

- Resolution: 720p / 1080p / 2K (1440p QHD)
- Auto Edit: Auto / Cinematic / Balanced / Dynamic
- Subtitles: On / Off
- Destination: read-only selected folder display
- Primary action: `Choose folder & render` before a folder is selected, then `Render video`

The dialog shows blockers before allowing folder selection/render.

### Timeline

Add a `Subtitles` track. Visual Beat blocks display transition markers at their right edge when transitionOut is not CUT.

### Preview

Active subtitle is centered above the lower safe margin. Motion/transition effects use the current Auto Edit decision. Playback controls continue to operate on the global project timeline.

## Error handling

- Audio load/play failure stops playback and surfaces a preview error instead of silently advancing the playhead.
- Folder-picker cancellation is not an error and creates no job.
- Destination path write failure fails finalization with a clear error while preserving the internal completed render artifact when possible.
- Missing subtitle cues do not block render; subtitle toggle becomes disabled with a descriptive message.
- Transition planning falls back to CUT if a transition would violate minimum-duration safety rules.
- Unsupported or malformed render resolution values are rejected before a render job is queued.

## Testing

Add focused tests for:

- audio-master playhead calculations and chapter handoff;
- seek -> narration currentTime mapping;
- Auto Edit transition decisions;
- transition duration clamping;
- subtitle cue derivation and active-cue lookup;
- folder-picker IPC cancellation and selected path return;
- render start refusing to queue before a destination is selected;
- render finalization copying/moving final MP4 to the selected destination;
- backend/API acceptance of `1440p` and rejection of unsupported resolution values;
- 16:9 2K output resolving to `2560x1440`;
- non-16:9 output preserving aspect ratio with encoder-safe even dimensions;
- RenderScreen and Editor using the same render controller;
- renderer transition/subtitle command generation.

Run desktop unit tests, backend render-request/use-case tests, typecheck/build, and existing render regression tests before completion.
