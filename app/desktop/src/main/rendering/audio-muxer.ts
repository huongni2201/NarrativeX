import { join } from "node:path";
import { buildMuxNarrationArgs } from "../../shared/audio-muxer-args";
import { V2_VIDEO_QUALITY, type VideoQualityProfile } from "../../shared/video-encoding.ts";
import { runProcess } from "./process-runner";
import { RenderExecutionError } from "./render-errors";
import type { VideoEncoder } from "./video-encoder";

export async function muxNarration(
  ffmpegPath: string,
  workDirectory: string,
  videoPath: string,
  audioPath: string,
  subtitlePath: string | null = null,
  signal?: AbortSignal,
  videoEncoder: VideoEncoder = "libx264",
  videoQuality: VideoQualityProfile = V2_VIDEO_QUALITY,
): Promise<string> {
  const output = join(workDirectory, "final.mp4");
  const process = runProcess(
    ffmpegPath,
    buildMuxNarrationArgs(
      videoPath,
      audioPath,
      subtitlePath,
      output,
      videoEncoder,
      videoQuality,
    ),
    undefined,
    signal,
  );
  const result = await process.result;
  if (result.exitCode !== 0) {
    throw new RenderExecutionError(
      "FFMPEG_MUX_FAILED",
      result.stderr.trim() || "Unable to mux narration audio and subtitles.",
    );
  }
  return output;
}
