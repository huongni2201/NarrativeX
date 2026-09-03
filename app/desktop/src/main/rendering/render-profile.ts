import {
  LEGACY_VIDEO_QUALITY,
  V2_VIDEO_QUALITY,
  type VideoQualityProfile,
} from "../../shared/video-encoding.ts";

export type RenderColorMode = "LEGACY_UNSPECIFIED" | "SDR_BT709_LIMITED";

export interface ParsedRenderProfile {
  schemaVersion: 1 | 2;
  rendererVersion: string;
  compositionPolicyVersion: number;
  fps: 30 | 60;
  subtitleMode: "burn_in" | "none";
  video: VideoQualityProfile;
  colorMode: RenderColorMode;
}

const X264_PRESETS = new Set<VideoQualityProfile["x264Preset"]>([
  "veryfast",
  "faster",
  "fast",
  "medium",
  "slow",
]);
const NVENC_PRESETS = new Set<VideoQualityProfile["nvencPreset"]>(["p4", "p5", "p6", "p7"]);

export function parseRenderProfile(renderProfileJson: string): ParsedRenderProfile {
  let raw: unknown;
  try {
    raw = JSON.parse(renderProfileJson);
  } catch {
    return legacyProfile({});
  }
  if (!isRecord(raw)) return legacyProfile({});

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion == null || schemaVersion === 1) return legacyProfile(raw);
  if (schemaVersion !== 2) {
    throw new Error(`Unsupported render profile schema: ${String(schemaVersion)}.`);
  }
  return v2Profile(raw);
}

function legacyProfile(raw: Record<string, unknown>): ParsedRenderProfile {
  return {
    schemaVersion: 1,
    rendererVersion: "project-image-motion-v2-frame-quantized",
    compositionPolicyVersion: 0,
    fps: supportedFps(raw.fps),
    subtitleMode: subtitleMode(raw),
    video: { ...LEGACY_VIDEO_QUALITY },
    colorMode: "LEGACY_UNSPECIFIED",
  };
}

function v2Profile(raw: Record<string, unknown>): ParsedRenderProfile {
  const video = isRecord(raw.video) ? raw.video : {};
  const color = isRecord(raw.color) ? raw.color : {};
  return {
    schemaVersion: 2,
    rendererVersion:
      raw.rendererVersion === "project-image-motion-v3-composition"
        ? raw.rendererVersion
        : "project-image-motion-v3-composition",
    compositionPolicyVersion: raw.compositionPolicyVersion === 1 ? 1 : 1,
    fps: supportedFps(raw.fps),
    subtitleMode: subtitleMode(raw),
    video: {
      x264Preset: X264_PRESETS.has(video.x264Preset as VideoQualityProfile["x264Preset"])
        ? (video.x264Preset as VideoQualityProfile["x264Preset"])
        : V2_VIDEO_QUALITY.x264Preset,
      crf: qualityInteger(video.crf, V2_VIDEO_QUALITY.crf),
      nvencPreset: NVENC_PRESETS.has(video.nvencPreset as VideoQualityProfile["nvencPreset"])
        ? (video.nvencPreset as VideoQualityProfile["nvencPreset"])
        : V2_VIDEO_QUALITY.nvencPreset,
      nvencCq: qualityInteger(video.nvencCq, V2_VIDEO_QUALITY.nvencCq),
      pixelFormat: video.pixelFormat === "yuv420p" ? "yuv420p" : V2_VIDEO_QUALITY.pixelFormat,
    },
    colorMode: color.mode === "SDR_BT709_LIMITED" ? "SDR_BT709_LIMITED" : "SDR_BT709_LIMITED",
  };
}

function supportedFps(value: unknown): 30 | 60 {
  return value === 60 ? 60 : 30;
}

function subtitleMode(raw: Record<string, unknown>): "burn_in" | "none" {
  const subtitles = isRecord(raw.subtitles) ? raw.subtitles : {};
  return subtitles.mode === "none" ? "none" : "burn_in";
}

function qualityInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 51
    ? Number(value)
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
