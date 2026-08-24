import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import type { LocalRenderManifest, LocalRenderBeat } from "./render-manifest";
import { runProcess } from "./process-runner";
import { RenderExecutionError } from "./render-errors";

export async function renderSegments(ffmpegPath: string, workDirectory: string, manifest: LocalRenderManifest, signal: AbortSignal): Promise<string[]> {
  const directory = join(workDirectory, "segments");
  await mkdir(directory, { recursive: true });
  const paths: string[] = [];
  for (const [index, beat] of manifest.beats.entries()) {
    if (signal.aborted) throw new RenderExecutionError("RENDER_CANCELLED", "Render was cancelled.");
    const output = join(directory, `${String(index).padStart(5, "0")}.mp4`);
    const duration = (beat.globalEndMs - beat.globalStartMs) / 1000;
    const imageInput = [".jpg", ".jpeg", ".png", ".webp"].includes(extname(beat.localPath).toLowerCase());
    const input = imageInput ? ["-loop", "1", "-i", beat.localPath] : ["-i", beat.localPath];
    const process = runProcess(ffmpegPath, [...input, "-t", duration.toFixed(3), "-vf", `scale=${manifest.width}:${manifest.height}:force_original_aspect_ratio=decrease,pad=${manifest.width}:${manifest.height}:(ow-iw)/2:(oh-ih)/2`, "-r", String(manifest.fps), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", output], undefined, signal);
    const result = await process.result;
    if (result.exitCode !== 0) throw new RenderExecutionError("FFMPEG_SEGMENT_FAILED", result.stderr.trim() || `Unable to render visual beat ${beat.visualBeatId}.`);
    paths.push(output);
  }
  return paths;
}
