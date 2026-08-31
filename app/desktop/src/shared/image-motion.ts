export interface ImageMotionPreset {
  zoomStart: number;
  zoomEnd: number;
  panXStart: number;
  panXEnd: number;
  panYStart: number;
  panYEnd: number;
}

export interface ImageMotionSample {
  zoom: number;
  panX: number;
  panY: number;
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

export function sampleImageMotion(
  cameraMovement: string | null | undefined,
  progress: number,
): ImageMotionSample {
  const preset = imageMotionPreset(cameraMovement);
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    zoom: lerp(preset.zoomStart, preset.zoomEnd, clamped),
    panX: lerp(preset.panXStart, preset.panXEnd, clamped),
    panY: lerp(preset.panYStart, preset.panYEnd, clamped),
  };
}

export function cssImageTransform(
  cameraMovement: string | null | undefined,
  progress: number,
): string {
  const sample = sampleImageMotion(cameraMovement, progress);
  const translateX = -sample.panX * (sample.zoom - 1) * 50;
  const translateY = -sample.panY * (sample.zoom - 1) * 50;
  if (Math.abs(translateX) < 0.0005 && Math.abs(translateY) < 0.0005) {
    return sample.zoom === 1 ? "scale(1)" : `scale(${sample.zoom.toFixed(4)})`;
  }
  return `translate(${translateX.toFixed(3)}%, ${translateY.toFixed(3)}%) scale(${sample.zoom.toFixed(4)})`;
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
