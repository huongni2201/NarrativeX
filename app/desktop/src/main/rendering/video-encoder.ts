import { runProcess } from "./process-runner";

export type VideoEncoder = "h264_nvenc" | "libx264";

const DEFAULT_HARDWARE_CONCURRENCY = 3;
const DEFAULT_SOFTWARE_CONCURRENCY = 2;
const MAX_RENDER_CONCURRENCY = 4;

export async function resolveVideoEncoder(
  ffmpegPath: string,
  hardwareAccelerationAllowed: boolean,
): Promise<VideoEncoder> {
  if (!hardwareAccelerationAllowed) return "libx264";

  try {
    const probe = await runProcess(ffmpegPath, nvencProbeArgs()).result;
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

function nvencProbeArgs(): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=64x64:r=1",
    "-frames:v",
    "1",
    "-an",
    "-c:v",
    "h264_nvenc",
    "-pix_fmt",
    "yuv420p",
    "-f",
    "null",
    "-",
  ];
}
