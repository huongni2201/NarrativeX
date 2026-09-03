import {
  buildVideoEncodeArgs,
  V2_VIDEO_QUALITY,
  type VideoEncoder,
  type VideoQualityProfile,
} from "./video-encoding.ts";

export function buildMuxNarrationArgs(
  videoPath: string,
  audioPath: string,
  subtitlePath: string | null,
  output: string,
  videoEncoder: VideoEncoder = "libx264",
  videoQuality: VideoQualityProfile = V2_VIDEO_QUALITY,
): string[] {
  if (!subtitlePath) {
    return [
      "-i", videoPath,
      "-i", audioPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
      "-y", output,
    ];
  }

  return [
    "-i", videoPath,
    "-i", audioPath,
    "-vf", `subtitles=filename='${escapeSubtitleFilterPath(subtitlePath)}'`,
    "-map", "0:v:0",
    "-map", "1:a:0",
    ...buildVideoEncodeArgs(videoEncoder, videoQuality),
    "-c:a", "aac",
    "-shortest",
    "-y", output,
  ];
}

export function escapeSubtitleFilterPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}
