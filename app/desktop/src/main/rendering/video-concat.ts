import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runProcess } from "./process-runner";
import { RenderExecutionError } from "./render-errors";

export async function concatVideo(ffmpegPath: string, workDirectory: string, segments: readonly string[], signal?: AbortSignal): Promise<string> {
  const listPath = join(workDirectory, "video.concat.txt");
  await writeFile(listPath, segments.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n") + "\n", "utf8");
  const output = join(workDirectory, "video.mp4");
  const process = runProcess(ffmpegPath, ["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-y", output], undefined, signal);
  const result = await process.result;
  if (result.exitCode !== 0) throw new RenderExecutionError("FFMPEG_VIDEO_CONCAT_FAILED", result.stderr.trim() || "Unable to concatenate video segments.");
  return output;
}
