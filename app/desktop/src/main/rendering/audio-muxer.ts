import { join } from "node:path";
import { runProcess } from "./process-runner";
import { RenderExecutionError } from "./render-errors";

export async function muxNarration(ffmpegPath: string, workDirectory: string, videoPath: string, audioPath: string, signal?: AbortSignal): Promise<string> {
  const output = join(workDirectory, "final.mp4");
  const process = runProcess(ffmpegPath, ["-i", videoPath, "-i", audioPath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-shortest", "-y", output], undefined, signal);
  const result = await process.result;
  if (result.exitCode !== 0) throw new RenderExecutionError("FFMPEG_MUX_FAILED", result.stderr.trim() || "Unable to mux narration audio.");
  return output;
}
