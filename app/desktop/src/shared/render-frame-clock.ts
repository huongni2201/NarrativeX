export interface RenderFrameWindow {
  startFrame: number;
  endFrame: number;
  frameCount: number;
  durationSeconds: number;
}

export interface RenderTimelineBeatWindowInput {
  startMs: number;
  endMs: number;
}

export function renderFrameWindow(
  globalStartMs: number,
  globalEndMs: number,
  fps: number,
): RenderFrameWindow {
  if (!Number.isFinite(fps) || fps <= 0 || globalEndMs <= globalStartMs) {
    throw new Error("Invalid render frame window.");
  }
  const startFrame = Math.round((globalStartMs * fps) / 1000);
  const endFrame = Math.max(startFrame + 1, Math.round((globalEndMs * fps) / 1000));
  return frameWindow(startFrame, endFrame, fps);
}

export function renderProjectFrameWindows(
  beats: readonly RenderTimelineBeatWindowInput[],
  totalDurationMs: number,
  fps: number,
): RenderFrameWindow[] {
  if (
    !Number.isFinite(fps) ||
    fps <= 0 ||
    !Number.isFinite(totalDurationMs) ||
    totalDurationMs <= 0 ||
    beats.length === 0
  ) {
    throw new Error("Invalid render frame partition.");
  }

  const projectEndFrame = Math.ceil((totalDurationMs * fps) / 1000);
  if (projectEndFrame < beats.length) {
    throw new Error("Invalid render frame partition.");
  }

  const windows: RenderFrameWindow[] = [];
  let startFrame = 0;
  for (let index = 0; index < beats.length; index += 1) {
    const beat = beats[index]!;
    if (
      !Number.isFinite(beat.startMs) ||
      !Number.isFinite(beat.endMs) ||
      beat.endMs <= beat.startMs
    ) {
      throw new Error("Invalid render frame partition.");
    }
    if (index === 0 && Math.abs(beat.startMs) > 0.5) {
      throw new Error("Invalid render frame partition.");
    }
    if (index > 0) {
      const previous = beats[index - 1]!;
      if (Math.abs(previous.endMs - beat.startMs) > 0.5) {
        throw new Error("Invalid render frame partition.");
      }
    }

    const remainingBeats = beats.length - index - 1;
    const latestEndFrame = projectEndFrame - remainingBeats;
    const desiredEndFrame =
      index === beats.length - 1
        ? projectEndFrame
        : Math.round((beat.endMs * fps) / 1000);
    const endFrame = Math.max(startFrame + 1, Math.min(desiredEndFrame, latestEndFrame));
    if (endFrame <= startFrame || endFrame > projectEndFrame) {
      throw new Error("Invalid render frame partition.");
    }
    windows.push(frameWindow(startFrame, endFrame, fps));
    startFrame = endFrame;
  }

  if (startFrame !== projectEndFrame) {
    throw new Error("Invalid render frame partition.");
  }
  return windows;
}

export function projectFrameAtTime(
  projectTimeMs: number,
  fps: number,
  projectEndFrame: number,
): number {
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isInteger(projectEndFrame) || projectEndFrame <= 0) {
    throw new Error("Invalid render frame clock.");
  }
  const frame = Math.floor((Math.max(0, projectTimeMs) * fps) / 1000);
  return Math.max(0, Math.min(projectEndFrame - 1, frame));
}

function frameWindow(startFrame: number, endFrame: number, fps: number): RenderFrameWindow {
  const frameCount = endFrame - startFrame;
  return {
    startFrame,
    endFrame,
    frameCount,
    durationSeconds: frameCount / fps,
  };
}
