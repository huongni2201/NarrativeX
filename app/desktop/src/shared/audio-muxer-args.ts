export function buildMuxNarrationArgs(
  videoPath: string,
  audioPath: string,
  subtitlePath: string | null,
  output: string,
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
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
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
