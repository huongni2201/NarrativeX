export type SubtitlePosition =
  | "TOP_LEFT" | "TOP_CENTER" | "TOP_RIGHT"
  | "MIDDLE_LEFT" | "MIDDLE_CENTER" | "MIDDLE_RIGHT"
  | "BOTTOM_LEFT" | "BOTTOM_CENTER" | "BOTTOM_RIGHT";
export type SubtitlePreset = "DEFAULT" | "OUTLINE" | "SHADOW" | "BACKGROUND";
export type SubtitleFontFamily = "Arial" | "Verdana" | "Georgia" | "Tahoma";

export interface SubtitleStyle {
  version: 2;
  position: SubtitlePosition;
  preset: SubtitlePreset;
  fontFamily: SubtitleFontFamily;
  fontWeight: 400 | 700;
  fontSizeRatio: number;
  edgeMarginRatio: number;
  primaryColor: string;
  outlineColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
}

export interface ProjectSubtitleSettings {
  enabled: boolean;
  style: SubtitleStyle;
}
