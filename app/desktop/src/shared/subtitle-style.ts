export const SUBTITLE_STYLE_VERSION = 1 as const;

export const SUBTITLE_STYLE_V1 = Object.freeze({
  version: SUBTITLE_STYLE_VERSION,
  fontFamily: "Arial",
  fontWeight: 600,
  fontSizeRatio: 0.034,
  maxWidthRatio: 0.84,
  maxLines: 2,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  backgroundColor: "#000000",
  backgroundOpacity: 0.75,
  outlineWidthRatio: 0.002,
  shadowDepthRatio: 0.0015,
  bottomMarginRatio: 0.07,
} as const);

export type SubtitleStyle = typeof SUBTITLE_STYLE_V1;
