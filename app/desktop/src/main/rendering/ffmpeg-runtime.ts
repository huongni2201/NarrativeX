import { access } from "node:fs/promises";
import { join } from "node:path";
import { runProcess } from "./process-runner";

export interface FfmpegRuntimeStatus {
  available: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  version: string | null;
  reason: string | null;
}

export async function resolveFfmpegRuntime(): Promise<FfmpegRuntimeStatus> {
  const configured = process.env.NARRATIVEX_FFMPEG_PATH?.trim();
  const ffmpegPath = configured || join(process.resourcesPath, "ffmpeg", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const ffprobePath = configured
    ? (process.env.NARRATIVEX_FFPROBE_PATH?.trim() || ffmpegPath.replace(/ffmpeg(\.exe)?$/i, process.platform === "win32" ? "ffprobe.exe" : "ffprobe"))
    : join(process.resourcesPath, "ffmpeg", process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  try {
    await access(ffmpegPath);
    await access(ffprobePath);
    const version = await runProcess(ffmpegPath, ["-version"]).result;
    const probe = await runProcess(ffprobePath, ["-version"]).result;
    if (version.exitCode !== 0 || probe.exitCode !== 0) throw new Error("ffmpeg/ffprobe did not start successfully.");
    return { available: true, ffmpegPath, ffprobePath, version: version.stdout.split(/\r?\n/, 1)[0] ?? null, reason: null };
  } catch (error) {
    return { available: false, ffmpegPath: null, ffprobePath: null, version: null, reason: error instanceof Error ? error.message : "FFmpeg runtime is unavailable." };
  }
}
