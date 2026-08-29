import { join } from "node:path";
import { runProcess } from "./process-runner";
import { RenderExecutionError } from "./render-errors";

export async function muxNarration(
  ffmpegPath: string,
  workDirectory: string,
  videoPath: string,
  audioPath: string,
  subtitlePath: string | null = null,
  signal?: AbortSignal,
): Promise<string> {
  const output = join(workDirectory, "final.mp4");
  const process = runProcess(
    ffmpegPath,
    buildMuxNarrationArgs(videoPath, audioPath, subtitlePath, output),
    undefined,
    signal,
  );
  const result = await process.result;
  if (result.exitCode !== 0) {
    throw new RenderExecutionError(
      "FFMPEG_MUX_FAILED",
      result.stderr.trim() || "Unable to mux narration audio and subtitles.",
    );
  }
  return output;
}

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
    "-i", subtitlePath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-map", "2:s:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-c:s", "mov_text",
    "-metadata:s:s:0", "language=und",
    "-shortest",
    "-y", output,
  ];
}
