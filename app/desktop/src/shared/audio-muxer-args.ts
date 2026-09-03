export function buildMuxNarrationArgs(
  videoPath: string,
  audioPath: string,
  output: string,
): string[] {
  return [
    "-i", videoPath,
    "-i", audioPath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "copy",
    "-shortest",
    "-y", output,
  ];
}
