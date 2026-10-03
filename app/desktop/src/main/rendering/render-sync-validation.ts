export interface RenderSyncProbe {
  fps: number;
  width: number;
  height: number;
  durationMs: number;
  videoStartMs: number;
  videoDurationMs: number;
  audioStartMs: number;
  audioDurationMs: number;
}

export function validateRenderSync(
  probe: RenderSyncProbe,
  expectedDurationMs: number,
  fps: number,
  dimensions?: { width: number; height: number },
): void {
  if (!Number.isFinite(expectedDurationMs) || expectedDurationMs <= 0) {
    throw new Error("Expected render duration is invalid.");
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error("Render frame rate is invalid.");
  }
  if (!Number.isFinite(probe.fps) || Math.abs(probe.fps - fps) > 0.000001) {
    throw new Error("Final video frame rate does not match the render profile.");
  }
  if (dimensions && (probe.width !== dimensions.width || probe.height !== dimensions.height)) {
    throw new Error("Final video dimensions do not match the render profile.");
  }

  const frameMs = 1000 / fps;
  const startToleranceMs = Math.max(100, Math.ceil(frameMs * 2));
  const durationToleranceMs = Math.max(150, Math.ceil(frameMs * 3));

  if (Math.abs(probe.videoStartMs) > startToleranceMs) {
    throw new Error(
      `Final video starts ${Math.round(probe.videoStartMs)}ms away from the narration master clock.`,
    );
  }
  if (Math.abs(probe.audioStartMs) > startToleranceMs) {
    throw new Error(
      `Final audio starts ${Math.round(probe.audioStartMs)}ms away from the narration master clock.`,
    );
  }

  if (Math.abs(probe.videoDurationMs - expectedDurationMs) > durationToleranceMs) {
    throw new Error(
      `Final video duration ${Math.round(probe.videoDurationMs)}ms does not match expected narration duration ${Math.round(expectedDurationMs)}ms.`,
    );
  }
  if (Math.abs(probe.audioDurationMs - expectedDurationMs) > durationToleranceMs) {
    throw new Error(
      `Final audio duration ${Math.round(probe.audioDurationMs)}ms does not match expected narration duration ${Math.round(expectedDurationMs)}ms.`,
    );
  }

  const videoEndMs = probe.videoStartMs + probe.videoDurationMs;
  const audioEndMs = probe.audioStartMs + probe.audioDurationMs;
  if (Math.abs(videoEndMs - audioEndMs) > durationToleranceMs) {
    throw new Error(
      `Final audio/video end clocks diverge by ${Math.round(Math.abs(videoEndMs - audioEndMs))}ms.`,
    );
  }
}
