import { V2_VIDEO_QUALITY, type VideoQualityProfile } from "../../shared/video-encoding.ts";
import { parseSubtitleStyle, type SubtitleStyle } from "../../shared/subtitle-style.ts";

export type RenderColorMode = "SDR_BT709_LIMITED";

export interface ParsedRenderProfile {
  schemaVersion: 3 | 4;
  rendererVersion: "project-image-motion-v3-composition" | "project-native-av-v4";
  audioMode: "NATIVE_TAKE" | "EXTERNAL_NARRATION";
  compositionPolicyVersion: 1;
  fps: 24 | 30 | 60;
  subtitleMode: "burn_in" | "none";
  subtitleStyle?: SubtitleStyle;
  video: VideoQualityProfile;
  colorMode: RenderColorMode;
  watermark: { readonly mode: "required" | "none"; readonly policyVersion: 1 };
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
    throw new Error("Invalid render profile JSON.");
  }
  if (!isRecord(raw)) {
    throw new Error("Invalid render profile JSON.");
  }
  if (raw.schemaVersion !== 3 && raw.schemaVersion !== 4) {
    throw new Error(`Unsupported render profile schema: ${String(raw.schemaVersion)}.`);
  }

  if (raw.schemaVersion === 4 && raw.audioMode !== "NATIVE_TAKE" && raw.audioMode !== "EXTERNAL_NARRATION") {
    throw new Error("Invalid render audio mode.");
  }
  const video = isRecord(raw.video) ? raw.video : {};
  const color = isRecord(raw.color) ? raw.color : {};
  return {
    schemaVersion: raw.schemaVersion,
    rendererVersion: raw.schemaVersion === 4 ? "project-native-av-v4" : "project-image-motion-v3-composition",
    audioMode: raw.schemaVersion === 4 ? raw.audioMode as "NATIVE_TAKE" | "EXTERNAL_NARRATION" : "EXTERNAL_NARRATION",
    compositionPolicyVersion: 1,
    fps: supportedFps(raw.fps),
    subtitleMode: subtitleMode(raw),
    ...(isRecord(raw.subtitles) && raw.subtitles.style !== undefined
      ? { subtitleStyle: parseSubtitleStyle(raw.subtitles.style) } : {}),
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
    watermark: watermarkPolicy(raw),
  };
}

function watermarkPolicy(
  raw: Record<string, unknown>,
): { readonly mode: "required" | "none"; readonly policyVersion: 1 } {
  const watermark = isRecord(raw.watermark) ? raw.watermark : null;
  if (
    !watermark ||
    (watermark.mode !== "required" && watermark.mode !== "none") ||
    watermark.policyVersion !== 1
  ) {
    throw new Error("Invalid render watermark policy.");
  }
  return { mode: watermark.mode, policyVersion: 1 };
}

function supportedFps(value: unknown): 24 | 30 | 60 {
  if (value === 24 || value === 30 || value === 60) return value;
  throw new Error(`Unsupported render frame rate: ${String(value)}.`);
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
