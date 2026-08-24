import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LocalRenderManifest } from "./render-manifest";
import { runProcess } from "./process-runner";
import { RenderExecutionError } from "./render-errors";

export async function concatNarration(ffmpegPath: string, workDirectory: string, manifest: LocalRenderManifest, signal?: AbortSignal): Promise<string> {
  const listPath = join(workDirectory, "audio.concat.txt");
  await writeFile(listPath, manifest.audio.chapters.map((chapter) => `file '${chapter.localPath.replaceAll("'", "'\\''")}'`).join("\n") + "\n", "utf8");
  const output = join(workDirectory, "narration.m4a");
  const process = runProcess(ffmpegPath, ["-f", "concat", "-safe", "0", "-i", listPath, "-vn", "-c:a", "aac", "-y", output], undefined, signal);
  const result = await process.result;
  if (result.exitCode !== 0) throw new RenderExecutionError("FFMPEG_AUDIO_CONCAT_FAILED", result.stderr.trim() || "Unable to concatenate narration audio.");
  return output;
}
