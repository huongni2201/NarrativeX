export const GEMINI_WEB_LANES = ["CHARACTER", "STORYBOARD"] as const;

export type GeminiWebLane = (typeof GEMINI_WEB_LANES)[number];

export function isGeminiWebLane(value: unknown): value is GeminiWebLane {
  return GEMINI_WEB_LANES.includes(value as GeminiWebLane);
}
