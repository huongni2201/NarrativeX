import type { DesktopTimelineBeat, RenderFrameRate } from "@narrativex/client-contracts";
import {
  compositionPolicyForBeat,
  cssTransformFromCompositionSample,
  sampleCompositionFrame,
} from "../../../shared/image-motion.ts";

export interface PreviewPlaybackState {
  mediaTimeMs: number;
  playbackRate: number;
  shouldPlayVideo: boolean;
  imageTransform: string;
}

export function previewPlaybackState(
  beat: DesktopTimelineBeat,
  playheadMs: number,
  frameRate: RenderFrameRate = 30,
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
    imageTransform: imageTransformForBeat(beat, localMs, frameRate),
  };
}

export function imageTransformForBeat(
  beat: Pick<DesktopTimelineBeat, "cameraMovement" | "durationMs">,
  localMs: number,
  frameRate: RenderFrameRate = 30,
): string {
  const frameCount = Math.max(1, Math.ceil((Math.max(1, beat.durationMs) * frameRate) / 1000));
  const localFrame = Math.min(frameCount - 1, Math.floor((Math.max(0, localMs) * frameRate) / 1000));
  const policy = compositionPolicyForBeat("IMAGE", beat.cameraMovement);
  return cssTransformFromCompositionSample(
    sampleCompositionFrame(policy, localFrame, frameCount, frameRate),
  );
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
  thresholdSeconds = 0.1,
): boolean {
  return Math.abs(currentSeconds - desiredSeconds) > thresholdSeconds;
}

export function shouldUseFallbackPlaybackClock({
  playing,
  hasNarration,
  narrationClockFailed,
}: {
  playing: boolean;
  hasNarration: boolean;
  narrationClockFailed: boolean;
}): boolean {
  return playing && (!hasNarration || narrationClockFailed);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
