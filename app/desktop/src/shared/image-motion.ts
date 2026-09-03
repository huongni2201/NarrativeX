export interface ImageMotionPreset {
  zoomStart: number;
  zoomEnd: number;
  panXStart: number;
  panXEnd: number;
  panYStart: number;
  panYEnd: number;
}

export type MediaFramingMode = "COVER" | "CONTAIN";
export type MotionEasing = "LINEAR" | "SMOOTHSTEP";
export type BeatTransitionType = "CUT" | "FADE_BLACK";

export interface BeatCompositionPolicyV1 {
  version: 1;
  framing: MediaFramingMode;
  cameraMovement: string;
  motionIntensity: number;
  motionEasing: MotionEasing;
  transitionType: BeatTransitionType;
  transitionInMs: number;
  transitionOutMs: number;
}

export interface CompositionFrameSample {
  zoom: number;
  centerX: number;
  centerY: number;
  videoOpacity: number;
}

const CENTERED: ImageMotionPreset = {
  zoomStart: 1,
  zoomEnd: 1,
  panXStart: 0,
  panXEnd: 0,
  panYStart: 0,
  panYEnd: 0,
};

export function imageMotionPreset(cameraMovement: string | null | undefined): ImageMotionPreset {
  switch (cameraMovement?.trim().toUpperCase() || "NONE") {
    case "PUSH_IN":
    case "ZOOM_IN":
      return { ...CENTERED, zoomEnd: 1.08 };
    case "PULL_OUT":
    case "ZOOM_OUT":
      return { ...CENTERED, zoomStart: 1.08 };
    case "PAN":
      return {
        ...CENTERED,
        zoomStart: 1.06,
        zoomEnd: 1.06,
        panXStart: 1,
        panXEnd: -1,
      };
    case "TILT":
      return {
        ...CENTERED,
        zoomStart: 1.06,
        zoomEnd: 1.06,
        panYStart: -1,
        panYEnd: 1,
      };
    case "TRACK":
      return {
        ...CENTERED,
        zoomStart: 1.04,
        zoomEnd: 1.04,
        panXStart: 1,
        panXEnd: -1,
      };
    case "PARALLAX":
      return {
        zoomStart: 1.03,
        zoomEnd: 1.07,
        panXStart: 1,
        panXEnd: -3 / 7,
        panYStart: -2 / 3,
        panYEnd: 2 / 7,
      };
    default:
      return CENTERED;
  }
}

export function compositionPolicyForBeat(
  mediaType: string | null | undefined,
  cameraMovement: string | null | undefined,
  transition: {
    transitionInMs?: number;
    transitionOutMs?: number;
  } = {},
): BeatCompositionPolicyV1 {
  const movement = normalizeMovement(cameraMovement);
  const movingImage = mediaType === "IMAGE" && movement !== "NONE";
  const transitionInMs = nonNegativeMs(transition.transitionInMs);
  const transitionOutMs = nonNegativeMs(transition.transitionOutMs);
  return {
    version: 1,
    framing: mediaType === "IMAGE" ? "COVER" : "CONTAIN",
    cameraMovement: movement,
    motionIntensity: movingImage ? 1 : 0,
    motionEasing: movingImage ? "SMOOTHSTEP" : "LINEAR",
    transitionType: transitionInMs > 0 || transitionOutMs > 0 ? "FADE_BLACK" : "CUT",
    transitionInMs,
    transitionOutMs,
  };
}

export function sampleCompositionFrame(
  policy: BeatCompositionPolicyV1,
  localFrame: number,
  frameCount: number,
  fps: number,
): CompositionFrameSample {
  const safeFrameCount = Math.max(1, Math.floor(frameCount));
  const safeFrame = Math.max(0, Math.min(safeFrameCount - 1, Math.floor(localFrame)));
  const rawProgress = safeFrameCount <= 1 ? 0 : safeFrame / (safeFrameCount - 1);
  const progress = policy.motionEasing === "SMOOTHSTEP" ? smoothstep(rawProgress) : rawProgress;
  const preset = imageMotionPreset(policy.cameraMovement);
  const intensity = clamp(policy.motionIntensity, 0, 1);

  const presetZoom = lerp(preset.zoomStart, preset.zoomEnd, progress);
  const presetCenterX = 0.5 + 0.5 * lerp(preset.panXStart, preset.panXEnd, progress);
  const presetCenterY = 0.5 + 0.5 * lerp(preset.panYStart, preset.panYEnd, progress);

  return {
    zoom: 1 + (presetZoom - 1) * intensity,
    centerX: clamp(0.5 + (presetCenterX - 0.5) * intensity, 0, 1),
    centerY: clamp(0.5 + (presetCenterY - 0.5) * intensity, 0, 1),
    videoOpacity: transitionOpacity(policy, safeFrame, safeFrameCount, fps),
  };
}

export function cssTransformFromCompositionSample(sample: CompositionFrameSample): string {
  const panX = (sample.centerX - 0.5) * 2;
  const panY = (sample.centerY - 0.5) * 2;
  const translateX = -panX * (sample.zoom - 1) * 50;
  const translateY = -panY * (sample.zoom - 1) * 50;
  if (Math.abs(translateX) < 0.0005 && Math.abs(translateY) < 0.0005) {
    return Math.abs(sample.zoom - 1) < 0.0000001
      ? "scale(1)"
      : `scale(${sample.zoom.toFixed(4)})`;
  }
  return `translate(${translateX.toFixed(3)}%, ${translateY.toFixed(3)}%) scale(${sample.zoom.toFixed(4)})`;
}

function transitionOpacity(
  policy: BeatCompositionPolicyV1,
  localFrame: number,
  frameCount: number,
  fps: number,
): number {
  if (policy.transitionType === "CUT" || !Number.isFinite(fps) || fps <= 0) return 1;
  const half = Math.floor(frameCount / 2);
  const transitionInFrames = Math.min(
    half,
    Math.max(0, Math.round((policy.transitionInMs * fps) / 1000)),
  );
  const transitionOutFrames = Math.min(
    half,
    Math.max(0, Math.round((policy.transitionOutMs * fps) / 1000)),
  );

  let opacity = 1;
  if (transitionInFrames > 0 && localFrame < transitionInFrames) {
    opacity = Math.min(
      opacity,
      transitionInFrames === 1 ? 1 : localFrame / (transitionInFrames - 1),
    );
  }
  const framesFromEnd = frameCount - 1 - localFrame;
  if (transitionOutFrames > 0 && framesFromEnd < transitionOutFrames) {
    opacity = Math.min(
      opacity,
      transitionOutFrames === 1 ? 1 : framesFromEnd / (transitionOutFrames - 1),
    );
  }
  return clamp(opacity, 0, 1);
}

function normalizeMovement(value: string | null | undefined): string {
  return value?.trim().toUpperCase() || "NONE";
}

function nonNegativeMs(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value ?? 0)) : 0;
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
