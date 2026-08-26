import { join } from "node:path";
import { runProcess } from "./process-runner";
import { RenderExecutionError } from "./render-errors";

export async function muxNarration(
  ffmpegPath: string,
  workDirectory: string,
  videoPath: string,
  audioPath: string,
  subtitlePath?: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const output = join(workDirectory, "final.mp4");
  const args = subtitlePath
    ? [
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-i",
        subtitlePath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-map",
        "2:s:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-c:s",
        "mov_text",
        "-metadata:s:s:0",
        "title=NarrativeX Captions",
        "-disposition:s:0",
        "default",
        "-y",
        output,
      ]
    : [
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        "-y",
        output,
      ];
  const process = runProcess(ffmpegPath, args, undefined, signal);
  const result = await process.result;
  if (result.exitCode !== 0) {
    throw new RenderExecutionError(
      "FFMPEG_MUX_FAILED",
      result.stderr.trim() || "Unable to mux narration audio and subtitles.",
    );
  }
  return output;
}
