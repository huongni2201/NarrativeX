import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const GOLDEN_FIXTURES = [
  "static-image",
  "slow-push-in",
  "horizontal-pan",
  "portrait-crop",
  "landscape-crop",
  "scene-transition",
  "subtitle-boundary",
];
export const GOLDEN_FRAME_RATES = [30, 60];
export const GOLDEN_RESOLUTIONS = [
  [1920, 1080],
  [2560, 1440],
];
export const GOLDEN_ENCODERS = ["libx264", "h264_nvenc"];

export function resolveFfmpegTools() {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const bundledRoot = resolve(import.meta.dirname, "..", "resources", "ffmpeg");
  const bundledFfmpeg = join(bundledRoot, `ffmpeg${suffix}`);
  const bundledFfprobe = join(bundledRoot, `ffprobe${suffix}`);
  if (existsSync(bundledFfmpeg) && existsSync(bundledFfprobe)) {
    return { ffmpeg: bundledFfmpeg, ffprobe: bundledFfprobe };
  }
  const ffmpeg = commandAvailable(`ffmpeg${suffix}`) ? `ffmpeg${suffix}` : null;
  const ffprobe = commandAvailable(`ffprobe${suffix}`) ? `ffprobe${suffix}` : null;
  return ffmpeg && ffprobe ? { ffmpeg, ffprobe } : null;
}

export async function runGoldenSmoke({ fps = 60, width = 1280, height = 720 } = {}) {
  const tools = resolveFfmpegTools();
  if (!tools) return null;
  const directory = await mkdtemp(join(tmpdir(), "narrativex-golden-render-"));
  const output = join(directory, "golden-smoke.mp4");
  const frameCount = fps * 2;
  const startedAt = performance.now();
  try {
    const filter = [
      `scale=${width * 2}:${height * 2}`,
      `zoompan=z='1+0.04*on/${Math.max(1, frameCount - 1)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=${width * 2}x${height * 2}:fps=${fps}`,
      `scale=${width}:${height}:flags=lanczos`,
      "format=yuv420p",
    ].join(",");
    const render = spawnSync(
      tools.ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        `testsrc2=size=${width}x${height}:rate=${fps}:duration=2`,
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=48000:duration=2",
        "-vf",
        filter,
        "-frames:v",
        String(frameCount),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-shortest",
        "-y",
        output,
      ],
      { encoding: "utf8" },
    );
    if (render.status !== 0) {
      throw new Error(`Golden render failed: ${render.stderr || render.stdout}`);
    }
    const wallClockMs = performance.now() - startedAt;
    const probe = spawnSync(
      tools.ffprobe,
      [
        "-v",
        "error",
        "-count_frames",
        "-show_entries",
        "stream=index,codec_type,width,height,avg_frame_rate,nb_read_frames,bit_rate:format=duration,size,bit_rate",
        "-of",
        "json",
        output,
      ],
      { encoding: "utf8" },
    );
    if (probe.status !== 0) throw new Error(`Golden ffprobe failed: ${probe.stderr || probe.stdout}`);
    const data = JSON.parse(probe.stdout);
    const video = data.streams.find((stream) => stream.codec_type === "video");
    return {
      wallClockMs,
      renderFps: frameCount / (wallClockMs / 1000),
      frameCount: Number(video?.nb_read_frames ?? 0),
      width: Number(video?.width ?? 0),
      height: Number(video?.height ?? 0),
      averageFrameRate: video?.avg_frame_rate ?? null,
      durationSeconds: Number(data.format?.duration ?? 0),
      bitrate: Number(data.format?.bit_rate ?? video?.bit_rate ?? 0),
      outputSizeBytes: Number(data.format?.size ?? 0),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function commandAvailable(command) {
  const result = spawnSync(command, ["-version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}
