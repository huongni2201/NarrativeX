export interface RenderFrameWindow {
  startFrame: number;
  endFrame: number;
  frameCount: number;
  durationSeconds: number;
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
  const frameCount = endFrame - startFrame;
  return {
    startFrame,
    endFrame,
    frameCount,
    durationSeconds: frameCount / fps,
  };
}
