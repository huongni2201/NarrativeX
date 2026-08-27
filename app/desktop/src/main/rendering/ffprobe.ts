import { runProcess } from "./process-runner";

export interface ProbedVideo {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  mimeType: "video/mp4";
  sizeBytes: number;
}

export async function probeMediaDuration(
  ffprobePath: string,
  filePath: string,
): Promise<number> {
  const process = runProcess(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const result = await process.result;
  if (result.exitCode !== 0) {
    throw new Error(`ffprobe failed: ${result.stderr.trim() || "unknown error"}`);
  }
  const durationSeconds = Number(result.stdout.trim());
  const durationMs = Math.round(durationSeconds * 1000);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("ffprobe returned an invalid media duration.");
  }
  return durationMs;
}

export async function probeVideo(ffprobePath: string, filePath: string): Promise<ProbedVideo> {
  const process = runProcess(ffprobePath, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath]);
  const result = await process.result;
  if (result.exitCode !== 0) throw new Error(`ffprobe failed: ${result.stderr.trim() || "unknown error"}`);
  const payload = JSON.parse(result.stdout) as { format?: { duration?: string; size?: string }; streams?: Array<{ codec_type?: string; width?: number; height?: number; r_frame_rate?: string }> };
  const stream = payload.streams?.find((candidate) => candidate.codec_type === "video");
  if (!stream?.width || !stream.height || !stream.r_frame_rate || !payload.format?.duration) throw new Error("ffprobe output is missing required video metadata.");
  const [numerator, denominator] = stream.r_frame_rate.split("/").map(Number);
  const fps = denominator ? numerator / denominator : numerator;
  const durationMs = Math.round(Number(payload.format.duration) * 1000);
  const sizeBytes = Number(payload.format.size ?? 0);
  if (![fps, durationMs, sizeBytes].every(Number.isFinite)) throw new Error("ffprobe returned invalid numeric metadata.");
  return { durationMs, width: stream.width, height: stream.height, fps, mimeType: "video/mp4", sizeBytes };
}
