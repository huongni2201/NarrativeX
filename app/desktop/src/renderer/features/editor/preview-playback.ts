import type { DesktopTimelineBeat } from "@narrativex/client-contracts";

export interface PreviewPlaybackState {
  mediaTimeMs: number;
  playbackRate: number;
  shouldPlayVideo: boolean;
  imageTransform: string;
}

export function previewPlaybackState(
  beat: DesktopTimelineBeat,
  playheadMs: number,
): PreviewPlaybackState {
  const localMs = clamp(playheadMs - beat.startMs, 0, Math.max(0, beat.durationMs));
  const sourceDurationMs = beat.sourceDurationMs ?? beat.durationMs;
  const availableMs = Math.max(1, sourceDurationMs - beat.trimStartMs);

  let mediaTimeMs = beat.trimStartMs + localMs;
  let playbackRate = 1;
  let shouldPlayVideo = beat.mediaType === "VIDEO";

  if (beat.mediaType === "VIDEO") {
    switch (beat.fitMode) {
      case "LOOP":
        mediaTimeMs = beat.trimStartMs + (localMs % availableMs);
        break;
      case "FREEZE_END": {
        const maxPlayableMs = Math.max(beat.trimStartMs, sourceDurationMs - 50);
        mediaTimeMs = Math.min(beat.trimStartMs + localMs, maxPlayableMs);
        shouldPlayVideo = beat.trimStartMs + localMs < maxPlayableMs;
        break;
      }
      case "SPEED_ADJUST":
        playbackRate = availableMs / Math.max(1, beat.durationMs);
        mediaTimeMs = beat.trimStartMs + localMs * playbackRate;
        break;
      case "TRIM":
      default:
        mediaTimeMs = Math.min(beat.trimStartMs + localMs, sourceDurationMs);
        break;
    }
  }

  return {
    mediaTimeMs: Math.max(0, mediaTimeMs),
    playbackRate: clamp(playbackRate, 0.25, 4),
    shouldPlayVideo,
    imageTransform: imageTransformForBeat(beat, localMs),
  };
}

export function imageTransformForBeat(
  beat: Pick<DesktopTimelineBeat, "cameraMovement" | "durationMs">,
  localMs: number,
): string {
  const progress = clamp(localMs / Math.max(1, beat.durationMs), 0, 1);
  const movement = beat.cameraMovement?.trim().toUpperCase() || "NONE";

  switch (movement) {
    case "PUSH_IN":
    case "ZOOM_IN":
      return `scale(${(1 + progress * 0.08).toFixed(4)})`;
    case "PULL_OUT":
    case "ZOOM_OUT":
      return `scale(${(1.08 - progress * 0.08).toFixed(4)})`;
    case "PAN":
      return `scale(1.06) translateX(${(-3 + progress * 6).toFixed(3)}%)`;
    case "TILT":
      return `scale(1.06) translateY(${(3 - progress * 6).toFixed(3)}%)`;
    case "TRACK":
      return `scale(1.04) translateX(${(-2 + progress * 4).toFixed(3)}%)`;
    case "PARALLAX":
      return `scale(${(1.03 + progress * 0.04).toFixed(4)}) translate(${(-1.5 + progress * 3).toFixed(3)}%, ${(1 - progress * 2).toFixed(3)}%)`;
    default:
      return "scale(1)";
  }
}

export function narrationTimeMs(
  playheadMs: number,
  chapterStartMs: number,
  chapterEndMs: number,
): number {
  return clamp(playheadMs - chapterStartMs, 0, Math.max(0, chapterEndMs - chapterStartMs));
}

export function globalPlayheadFromNarrationSeconds(
  currentTimeSeconds: number,
  chapterStartMs: number,
  chapterEndMs: number,
): number {
  const chapterDurationMs = Math.max(0, chapterEndMs - chapterStartMs);
  const localMs = clamp(currentTimeSeconds * 1000, 0, chapterDurationMs);
  return chapterStartMs + localMs;
}

export function narrationSeekSeconds(
  globalPlayheadMs: number,
  chapterStartMs: number,
  chapterEndMs: number,
): number {
  return narrationTimeMs(globalPlayheadMs, chapterStartMs, chapterEndMs) / 1000;
}

export function shouldResyncNarration(
  currentSeconds: number,
  desiredSeconds: number,
  thresholdSeconds = 0.35,
): boolean {
  return Math.abs(currentSeconds - desiredSeconds) > thresholdSeconds;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
