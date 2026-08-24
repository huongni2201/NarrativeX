import { runProcess } from "./process-runner";

export interface ProbedVideo {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  mimeType: "video/mp4";
  sizeBytes: number;
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
