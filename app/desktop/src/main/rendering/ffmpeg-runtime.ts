import { dirname, join } from "node:path";
import { runProcess } from "./process-runner";

export interface FfmpegRuntimeStatus {
  available: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  version: string | null;
  reason: string | null;
}

interface FfmpegCandidate {
  ffmpegPath: string;
  ffprobePath: string;
}

export async function resolveFfmpegRuntime(): Promise<FfmpegRuntimeStatus> {
  const candidates = runtimeCandidates();
  let lastError: string | null = null;

  for (const candidate of candidates) {
    try {
      const [version, probe] = await Promise.all([
        runProcess(candidate.ffmpegPath, ["-version"]).result,
        runProcess(candidate.ffprobePath, ["-version"]).result,
      ]);
      if (version.exitCode !== 0 || probe.exitCode !== 0) {
        throw new Error("ffmpeg/ffprobe did not start successfully.");
      }
      return {
        available: true,
        ffmpegPath: candidate.ffmpegPath,
        ffprobePath: candidate.ffprobePath,
        version: version.stdout.split(/\r?\n/, 1)[0] ?? null,
        reason: null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "FFmpeg runtime probe failed.";
    }
  }

  return {
    available: false,
    ffmpegPath: null,
    ffprobePath: null,
    version: null,
    reason: lastError ?? "FFmpeg runtime is unavailable.",
  };
}

function runtimeCandidates(): FfmpegCandidate[] {
  const executable = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const probeExecutable = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  const configuredFfmpeg = process.env.NARRATIVEX_FFMPEG_PATH?.trim();

  if (configuredFfmpeg) {
    return [
      {
        ffmpegPath: configuredFfmpeg,
        ffprobePath:
          process.env.NARRATIVEX_FFPROBE_PATH?.trim() ||
          join(dirname(configuredFfmpeg), probeExecutable),
      },
    ];
  }

  return [
    {
      ffmpegPath: join(process.resourcesPath, "ffmpeg", executable),
      ffprobePath: join(process.resourcesPath, "ffmpeg", probeExecutable),
    },
    { ffmpegPath: executable, ffprobePath: probeExecutable },
  ];
}
