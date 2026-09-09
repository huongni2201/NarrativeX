const MAX_WORKING_LONG_EDGE = 5120;

export function renderWorkingDimensions(
  width: number,
  height: number,
  moving: boolean,
  cameraMovement = "NONE",
  fps: 30 | 60 = 30,
): { width: number; height: number } {
  if (!moving) return { width: even(width), height: even(height) };
  const movement = cameraMovement.trim().toUpperCase();
  const factor =
    fps === 60 && (movement === "PAN" || movement === "TILT")
      ? 5
      : movement === "PAN" || movement === "TILT"
        ? 1.5
        : 1.25;
  let workingWidth = even(width * factor);
  let workingHeight = even(height * factor);
  const longEdge = Math.max(workingWidth, workingHeight);
  if (longEdge > MAX_WORKING_LONG_EDGE) {
    const ratio = MAX_WORKING_LONG_EDGE / longEdge;
    workingWidth = even(workingWidth * ratio);
    workingHeight = even(workingHeight * ratio);
  }
  return {
    width: Math.max(even(width), workingWidth),
    height: Math.max(even(height), workingHeight),
  };
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}
