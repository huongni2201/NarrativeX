export type VideoEncoder = "h264_nvenc" | "libx264";

export interface VideoQualityProfile {
  x264Preset: "veryfast" | "faster" | "fast" | "medium" | "slow";
  crf: number;
  nvencPreset: "p4" | "p5" | "p6" | "p7";
  nvencCq: number;
  pixelFormat: "yuv420p";
}

export const LEGACY_VIDEO_QUALITY: VideoQualityProfile = Object.freeze({
  x264Preset: "veryfast",
  crf: 20,
  nvencPreset: "p5",
  nvencCq: 21,
  pixelFormat: "yuv420p",
});

export const V2_VIDEO_QUALITY: VideoQualityProfile = Object.freeze({
  x264Preset: "medium",
  crf: 18,
  nvencPreset: "p6",
  nvencCq: 19,
  pixelFormat: "yuv420p",
});

export function buildVideoEncodeArgs(
  videoEncoder: VideoEncoder,
  profile: VideoQualityProfile,
): string[] {
  if (videoEncoder === "h264_nvenc") {
    return [
      "-c:v",
      "h264_nvenc",
      "-preset",
      profile.nvencPreset,
      "-rc",
      "vbr",
      "-cq",
      String(profile.nvencCq),
      "-b:v",
      "0",
      "-pix_fmt",
      profile.pixelFormat,
    ];
  }
  return [
    "-c:v",
    "libx264",
    "-preset",
    profile.x264Preset,
    "-crf",
    String(profile.crf),
    "-pix_fmt",
    profile.pixelFormat,
  ];
}
