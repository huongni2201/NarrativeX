import type { ProjectSubtitleSettings, SubtitleStyle } from "@narrativex/client-contracts";
export type { SubtitleStyle } from "@narrativex/client-contracts";

export const SUBTITLE_STYLE_VERSION = 2 as const;

export const SUBTITLE_STYLE_V1 = Object.freeze({
  version: 1,
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

export const SUBTITLE_FONTS = ["Arial", "Verdana", "Georgia", "Tahoma"] as const;
export const SUBTITLE_POSITIONS = [
  "BOTTOM_LEFT", "BOTTOM_CENTER", "BOTTOM_RIGHT", "MIDDLE_LEFT", "MIDDLE_CENTER",
  "MIDDLE_RIGHT", "TOP_LEFT", "TOP_CENTER", "TOP_RIGHT",
] as const;
export const SUBTITLE_PRESETS = ["DEFAULT", "OUTLINE", "SHADOW", "BACKGROUND"] as const;

export const DEFAULT_SUBTITLE_STYLE: Readonly<SubtitleStyle> = Object.freeze({
  version: 2, position: "BOTTOM_CENTER", preset: "DEFAULT", fontFamily: "Arial",
  fontWeight: 700, fontSizeRatio: 0.034, edgeMarginRatio: 0.07,
  primaryColor: "#FFFFFF", outlineColor: "#000000", backgroundColor: "#000000", backgroundOpacity: 0.75,
});

export function parseSubtitleStyle(value: unknown = DEFAULT_SUBTITLE_STYLE): SubtitleStyle {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid subtitle style.");
  const style = value as SubtitleStyle;
  const ratio = (number: unknown, min: number, max: number) =>
    typeof number === "number" && Number.isFinite(number) && number >= min && number <= max;
  if (style.version !== 2 || !SUBTITLE_POSITIONS.includes(style.position) ||
      !SUBTITLE_PRESETS.includes(style.preset) || !SUBTITLE_FONTS.includes(style.fontFamily) ||
      (style.fontWeight !== 400 && style.fontWeight !== 700) ||
      !ratio(style.fontSizeRatio, 0.02, 0.08) || !ratio(style.edgeMarginRatio, 0.02, 0.2) ||
      !ratio(style.backgroundOpacity, 0, 1) ||
      ![style.primaryColor, style.outlineColor, style.backgroundColor].every((color) =>
        typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))) {
    throw new Error("Invalid subtitle style.");
  }
  return { version: 2, position: style.position, preset: style.preset, fontFamily: style.fontFamily,
    fontWeight: style.fontWeight, fontSizeRatio: style.fontSizeRatio, edgeMarginRatio: style.edgeMarginRatio,
    primaryColor: style.primaryColor.toUpperCase(), outlineColor: style.outlineColor.toUpperCase(),
    backgroundColor: style.backgroundColor.toUpperCase(), backgroundOpacity: style.backgroundOpacity };
}

export function parseProjectSubtitleSettings(value: unknown): ProjectSubtitleSettings {
  if (!value || typeof value !== "object" || typeof (value as ProjectSubtitleSettings).enabled !== "boolean") {
    throw new Error("Invalid project subtitle settings.");
  }
  if (!(value as ProjectSubtitleSettings).style) throw new Error("Invalid project subtitle settings.");
  return { enabled: (value as ProjectSubtitleSettings).enabled, style: parseSubtitleStyle((value as ProjectSubtitleSettings).style) };
}

export function subtitleGeometry(style: SubtitleStyle, width: number, height: number) {
  return {
    fontSize: Math.max(18, Math.round(height * style.fontSizeRatio)),
    marginH: Math.max(12, Math.round(width * style.edgeMarginRatio)),
    marginV: Math.max(12, Math.round(height * style.edgeMarginRatio)),
    outline: style.preset === "SHADOW" ? 0 : Math.max(1, Math.round(height * 0.002)),
    shadow: style.preset === "SHADOW" ? Math.max(1, Math.round(height * 0.004)) :
      style.preset === "DEFAULT" ? Math.max(0, Math.round(height * 0.0015)) : 0,
    alignment: SUBTITLE_POSITIONS.indexOf(style.position) + 1,
    borderStyle: style.preset === "DEFAULT" || style.preset === "BACKGROUND" ? 3 : 1,
  };
}
