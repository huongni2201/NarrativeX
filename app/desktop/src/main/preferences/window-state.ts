import type { SavedWindowState } from "./desktop-preferences";

export const DESKTOP_MIN_WIDTH = 1180;
export const DESKTOP_MIN_HEIGHT = 720;

export interface DisplayLike {
  id: number;
  workArea: { x: number; y: number; width: number; height: number };
}

export interface RestoredWindowState {
  bounds: { x: number; y: number; width: number; height: number };
  maximized: boolean;
}

export function defaultWindowBounds(display: DisplayLike) {
  return {
    x: display.workArea.x,
    y: display.workArea.y,
    width: Math.max(DESKTOP_MIN_WIDTH, display.workArea.width),
    height: Math.max(DESKTOP_MIN_HEIGHT, display.workArea.height),
  };
}

function intersectsDisplay(
  bounds: Pick<SavedWindowState, "x" | "y" | "width" | "height">,
  display: DisplayLike,
): boolean {
  const left = Math.max(bounds.x, display.workArea.x);
  const top = Math.max(bounds.y, display.workArea.y);
  const right = Math.min(bounds.x + bounds.width, display.workArea.x + display.workArea.width);
  const bottom = Math.min(bounds.y + bounds.height, display.workArea.y + display.workArea.height);
  return right - left >= 80 && bottom - top >= 80;
}

export function resolveRestoredWindowState(
  saved: SavedWindowState | null | undefined,
  displays: readonly DisplayLike[],
  fallbackDisplay: DisplayLike,
): RestoredWindowState {
  if (!saved || !displays.some((display) => intersectsDisplay(saved, display))) {
    return { bounds: defaultWindowBounds(fallbackDisplay), maximized: Boolean(saved?.maximized) };
  }

  const target = displays.find((display) => intersectsDisplay(saved, display)) ?? fallbackDisplay;
  const width = Math.min(
    Math.max(saved.width, Math.min(DESKTOP_MIN_WIDTH, target.workArea.width)),
    target.workArea.width,
  );
  const height = Math.min(
    Math.max(saved.height, Math.min(DESKTOP_MIN_HEIGHT, target.workArea.height)),
    target.workArea.height,
  );
  const maxX = target.workArea.x + target.workArea.width - width;
  const maxY = target.workArea.y + target.workArea.height - height;
  return {
    bounds: {
      x: Math.min(Math.max(saved.x, target.workArea.x), maxX),
      y: Math.min(Math.max(saved.y, target.workArea.y), maxY),
      width,
      height,
    },
    maximized: saved.maximized,
  };
}
