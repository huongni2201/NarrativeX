import {
  buildVideoEncodeArgs,
  V2_VIDEO_QUALITY,
  type VideoEncoder,
  type VideoQualityProfile,
} from "../../shared/video-encoding.ts";
import { runProcess } from "./process-runner";

export type { VideoEncoder } from "../../shared/video-encoding.ts";

const DEFAULT_HARDWARE_CONCURRENCY = 3;
const DEFAULT_SOFTWARE_CONCURRENCY = 2;
const MAX_RENDER_CONCURRENCY = 4;

export async function resolveVideoEncoder(
  ffmpegPath: string,
  hardwareAccelerationAllowed: boolean,
): Promise<VideoEncoder> {
  return resolveVideoEncoderForProfile(
    ffmpegPath,
    hardwareAccelerationAllowed,
    V2_VIDEO_QUALITY,
    64,
    64,
  );
}

export async function resolveVideoEncoderForProfile(
  ffmpegPath: string,
  hardwareAccelerationAllowed: boolean,
  profile: VideoQualityProfile,
  width: number,
  height: number,
): Promise<VideoEncoder> {
  if (!hardwareAccelerationAllowed) return "libx264";

  try {
    const probe = await runProcess(
      ffmpegPath,
      nvencProbeArgs(profile, evenDimension(width), evenDimension(height)),
    ).result;
    return probe.exitCode === 0 ? "h264_nvenc" : "libx264";
  } catch {
    return "libx264";
  }
}

export function renderConcurrencyForEncoder(
  videoEncoder: VideoEncoder,
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const configured = Number.parseInt(env.NARRATIVEX_RENDER_CONCURRENCY?.trim() ?? "", 10);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(MAX_RENDER_CONCURRENCY, configured);
  }
  return videoEncoder === "h264_nvenc"
    ? DEFAULT_HARDWARE_CONCURRENCY
    : DEFAULT_SOFTWARE_CONCURRENCY;
}

export function renderConcurrencyForWorkload(
  videoEncoder: VideoEncoder,
  width: number,
  height: number,
  fps: number,
  hasMovingStills: boolean,
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const base = renderConcurrencyForEncoder(videoEncoder, env);
  if (!hasMovingStills || width * height < 3840 * 2160) return base;
  return Math.min(base, fps >= 60 ? 1 : 2);
}

function nvencProbeArgs(
  profile: VideoQualityProfile,
  width: number,
  height: number,
): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${width}x${height}:r=1`,
    "-frames:v",
    "1",
    "-an",
    ...buildVideoEncodeArgs("h264_nvenc", profile),
    "-f",
    "null",
    "-",
  ];
}

function evenDimension(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 64;
  return Math.max(2, Math.round(value / 2) * 2);
}
