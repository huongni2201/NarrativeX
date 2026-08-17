export type PresetCategory =
  | "VISUAL_STYLE"
  | "IMAGE"
  | "MOTION"
  | "OUTFIT"
  | "RENDER";

export interface UsedInProjectItem {
  id: string;
  title: string;
  chaptersCount: number;
  coverImage: string;
}

export interface StylePreset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  coverImage: string;
  tags: string[];
  isDefault?: boolean;
  usedInProjectsCount: number;
  colorPalette?: string[];
  lighting?: string;
  atmosphere?: string;
  cameraStyle?: string;
  defaultAspectRatio?: string;
  defaultQuality?: string;
  motionPreset?: string;
  negativeRules?: string;
  usedInProjects?: UsedInProjectItem[];
  // Extended configuration for specific preset types
  motionType?: string;
  motionIntensity?: string;
  motionEasing?: string;
  renderResolution?: string;
  renderBitrate?: string;
  outfitTheme?: string;
  outfitDetails?: string;
}

export type PresetFilterCategory =
  | "all"
  | "VISUAL_STYLE"
  | "IMAGE"
  | "MOTION"
  | "OUTFIT"
  | "RENDER";
