import { runProcess } from "./process-runner";

export interface ProbedVideo {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  mimeType: "video/mp4";
  sizeBytes: number;
  videoStartMs: number;
  videoDurationMs: number;
  audioStartMs: number;
  audioDurationMs: number;
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
  const process = runProcess(ffprobePath, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  const result = await process.result;
  if (result.exitCode !== 0) {
    throw new Error(`ffprobe failed: ${result.stderr.trim() || "unknown error"}`);
  }

  const payload = JSON.parse(result.stdout) as {
    format?: { duration?: string; size?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      start_time?: string;
      duration?: string;
    }>;
  };
  const video = payload.streams?.find((candidate) => candidate.codec_type === "video");
  const audio = payload.streams?.find((candidate) => candidate.codec_type === "audio");
  if (
    !video?.width ||
    !video.height ||
    !video.r_frame_rate ||
    !payload.format?.duration ||
    !audio ||
    video.duration == null ||
    audio.duration == null
  ) {
    throw new Error("ffprobe output is missing required audio/video sync metadata.");
  }

  const [numerator, denominator] = video.r_frame_rate.split("/").map(Number);
  const fps = denominator ? numerator / denominator : numerator;
  const durationMs = milliseconds(payload.format.duration);
  const sizeBytes = Number(payload.format.size ?? 0);
  const videoStartMs = milliseconds(video.start_time ?? "0");
  const videoDurationMs = milliseconds(video.duration);
  const audioStartMs = milliseconds(audio.start_time ?? "0");
  const audioDurationMs = milliseconds(audio.duration);

  if (
    ![
      fps,
      durationMs,
      sizeBytes,
      videoStartMs,
      videoDurationMs,
      audioStartMs,
      audioDurationMs,
    ].every(Number.isFinite)
  ) {
    throw new Error("ffprobe returned invalid numeric metadata.");
  }
  if (durationMs <= 0 || videoDurationMs <= 0 || audioDurationMs <= 0) {
    throw new Error("ffprobe returned non-positive media duration metadata.");
  }

  return {
    durationMs,
    width: video.width,
    height: video.height,
    fps,
    mimeType: "video/mp4",
    sizeBytes,
    videoStartMs,
    videoDurationMs,
    audioStartMs,
    audioDurationMs,
  };
}

function milliseconds(seconds: string): number {
  return Math.round(Number(seconds) * 1000);
}
