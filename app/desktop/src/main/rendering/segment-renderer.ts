import { createHash } from "node:crypto";
import { copyFile, mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import type { LocalRenderManifest, LocalRenderBeat } from "./render-manifest";
import { runProcess, type ProcessResult } from "./process-runner";
import { RenderExecutionError } from "./render-errors";
import type { VideoEncoder } from "./video-encoder";

export interface SegmentRenderOptions {
  videoEncoder?: VideoEncoder;
  concurrency?: number;
}

export async function renderSegments(
  ffmpegPath: string,
  workDirectory: string,
  manifest: LocalRenderManifest,
  signal: AbortSignal,
  cacheDirectory?: string,
  options: SegmentRenderOptions = {},
): Promise<string[]> {
  const directory = join(workDirectory, "segments");
  await mkdir(directory, { recursive: true });
  if (cacheDirectory) await mkdir(cacheDirectory, { recursive: true });
  const paths = new Array<string>(manifest.beats.length);
  const videoEncoder = options.videoEncoder ?? "libx264";
  const concurrency = Math.max(
    1,
    Math.min(manifest.beats.length || 1, Math.floor(options.concurrency ?? 1)),
  );
  let nextIndex = 0;
  const failureController = new AbortController();
  const executionSignal = AbortSignal.any([signal, failureController.signal]);

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= manifest.beats.length) return;
      const beat = manifest.beats[index]!;

      if (failureController.signal.aborted) {
        throw failureController.signal.reason;
      }
      if (signal.aborted) {
        throw new RenderExecutionError("RENDER_CANCELLED", "Render was cancelled.");
      }

      const output = join(directory, `${String(index).padStart(5, "0")}.mp4`);
      const cachePath = cacheDirectory
        ? join(cacheDirectory, `${segmentCacheKey(manifest, beat, videoEncoder)}.mp4`)
        : null;
      if (cachePath && (await validCachedSegment(cachePath))) {
        await copyFile(cachePath, output);
        paths[index] = output;
        continue;
      }

      const durationSeconds = (beat.globalEndMs - beat.globalStartMs) / 1000;
      const args = buildBeatRenderArgs(
        manifest,
        beat,
        durationSeconds,
        output,
        videoEncoder,
      );
      const process = runProcess(ffmpegPath, args, undefined, executionSignal);
      let result: ProcessResult;
      try {
        result = await process.result;
      } catch (error) {
        if (!signal.aborted && !failureController.signal.aborted) {
          failureController.abort(error);
        }
        throw error;
      }
      if (result.exitCode !== 0) {
        const failure = new RenderExecutionError(
          "FFMPEG_SEGMENT_FAILED",
          result.stderr.trim() || `Unable to render visual beat ${beat.visualBeatId}.`,
        );
        if (!failureController.signal.aborted) failureController.abort(failure);
        throw failure;
      }

      if (cachePath) {
        const temporary = `${cachePath}.${Date.now()}.tmp`;
        await copyFile(output, temporary);
        await rename(temporary, cachePath);
      }
      paths[index] = output;
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return paths;
}

function buildBeatRenderArgs(
  manifest: LocalRenderManifest,
  beat: LocalRenderBeat,
  targetDurationSeconds: number,
  output: string,
  videoEncoder: VideoEncoder,
): string[] {
  if (!Number.isFinite(targetDurationSeconds) || targetDurationSeconds <= 0) {
    throw new RenderExecutionError(
      "INVALID_BEAT_DURATION",
      `Visual beat ${beat.visualBeatId} has an invalid narration duration.`,
    );
  }

  const target = targetDurationSeconds.toFixed(3);
  const baseFilter =
    `scale=${manifest.width}:${manifest.height}:force_original_aspect_ratio=decrease,` +
    `pad=${manifest.width}:${manifest.height}:(ow-iw)/2:(oh-ih)/2`;

  if (beat.mediaType === "IMAGE") {
    const filter = withTransitionFilters(
      imageMotionFilter(manifest, beat, targetDurationSeconds),
      beat,
      targetDurationSeconds,
    );
    return [
      "-i",
      beat.localPath,
      "-t",
      target,
      "-vf",
      filter,
      "-an",
      "-c:v",
      videoEncoder,
      "-pix_fmt",
      "yuv420p",
      "-y",
      output,
    ];
  }

  if (beat.mediaType !== "VIDEO") {
    throw new RenderExecutionError(
      "UNSUPPORTED_BEAT_MEDIA",
      `Visual beat ${beat.visualBeatId} has unsupported media type ${String(beat.mediaType)}.`,
    );
  }

  const trimStartSeconds = Math.max(0, beat.trimStartMs) / 1000;
  const inputSeek = trimStartSeconds > 0 ? ["-ss", trimStartSeconds.toFixed(3)] : [];
  const availableSeconds =
    beat.sourceDurationMs == null
      ? null
      : Math.max(0, beat.sourceDurationMs - beat.trimStartMs) / 1000;

  switch (beat.fitMode) {
    case "TRIM": {
      if (availableSeconds != null && availableSeconds + 0.001 < targetDurationSeconds) {
        throw new RenderExecutionError(
          "VIDEO_TOO_SHORT_FOR_TRIM",
          `Video for beat ${beat.visualBeatId} is shorter than its narration span. Choose Loop, Freeze End or Speed Adjust.`,
        );
      }
      return encodeVideoArgs(
        [...inputSeek, "-i", beat.localPath],
        withTransitionFilters(baseFilter, beat, targetDurationSeconds),
        target,
        manifest.fps,
        output,
        videoEncoder,
      );
    }
    case "LOOP":
      return encodeVideoArgs(
        ["-stream_loop", "-1", ...inputSeek, "-i", beat.localPath],
        withTransitionFilters(baseFilter, beat, targetDurationSeconds),
        target,
        manifest.fps,
        output,
        videoEncoder,
      );
    case "FREEZE_END": {
      const filter = withTransitionFilters(
        `${baseFilter},tpad=stop_mode=clone:stop_duration=${target}`,
        beat,
        targetDurationSeconds,
      );
      return encodeVideoArgs(
        [...inputSeek, "-i", beat.localPath],
        filter,
        target,
        manifest.fps,
        output,
        videoEncoder,
      );
    }
    case "SPEED_ADJUST": {
      if (availableSeconds == null || availableSeconds <= 0) {
        throw new RenderExecutionError(
          "VIDEO_DURATION_REQUIRED",
          `Speed Adjust requires a known source duration for beat ${beat.visualBeatId}.`,
        );
      }
      const ptsFactor = targetDurationSeconds / availableSeconds;
      if (!Number.isFinite(ptsFactor) || ptsFactor <= 0) {
        throw new RenderExecutionError(
          "INVALID_VIDEO_SPEED",
          `Unable to calculate video speed for beat ${beat.visualBeatId}.`,
        );
      }
      const filter = withTransitionFilters(
        `${baseFilter},setpts=${ptsFactor.toFixed(8)}*PTS`,
        beat,
        targetDurationSeconds,
      );
      return encodeVideoArgs(
        [...inputSeek, "-i", beat.localPath],
        filter,
        target,
        manifest.fps,
        output,
        videoEncoder,
      );
    }
    default:
      throw new RenderExecutionError(
        "UNSUPPORTED_VIDEO_FIT_MODE",
        `Unsupported video fit mode ${String(beat.fitMode)} for beat ${beat.visualBeatId}.`,
      );
  }
}

function imageMotionFilter(
  manifest: LocalRenderManifest,
  beat: LocalRenderBeat,
  targetDurationSeconds: number,
): string {
  const frames = Math.max(1, Math.round(targetDurationSeconds * manifest.fps));
  const progress = `(on/${Math.max(1, frames - 1)})`;
  const centeredX = "iw/2-(iw/zoom/2)";
  const centeredY = "ih/2-(ih/zoom/2)";
  const movement = beat.cameraMovement?.toUpperCase() ?? "NONE";

  let zoom = "1.0";
  let x = centeredX;
  let y = centeredY;

  switch (movement) {
    case "PUSH_IN":
    case "ZOOM_IN":
      zoom = `1+0.08*${progress}`;
      break;
    case "PULL_OUT":
    case "ZOOM_OUT":
      zoom = `1.08-0.08*${progress}`;
      break;
    case "PAN":
      zoom = "1.08";
      x = `(iw-iw/zoom)*${progress}`;
      break;
    case "TILT":
      zoom = "1.08";
      y = `(ih-ih/zoom)*${progress}`;
      break;
    case "TRACK":
      zoom = "1.06";
      x = `(iw-iw/zoom)*(1-${progress})`;
      break;
    case "PARALLAX":
      zoom = `1.03+0.05*${progress}`;
      x = `(iw-iw/zoom)*${progress}`;
      y = `(ih-ih/zoom)*(1-${progress})`;
      break;
    case "NONE":
    default:
      break;
  }

  return [
    `scale=${manifest.width}:${manifest.height}:force_original_aspect_ratio=increase`,
    `crop=${manifest.width}:${manifest.height}`,
    `zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${manifest.width}x${manifest.height}:fps=${manifest.fps}`,
    "setsar=1",
    "format=yuv420p",
  ].join(",");
}

function withTransitionFilters(
  videoFilter: string,
  beat: LocalRenderBeat,
  targetDurationSeconds: number,
): string {
  const filters = [videoFilter];
  const transitionInSeconds = Math.min(
    targetDurationSeconds / 2,
    Math.max(0, beat.transitionInMs) / 1000,
  );
  const transitionOutSeconds = Math.min(
    targetDurationSeconds / 2,
    Math.max(0, beat.transitionOutMs) / 1000,
  );
  if (transitionInSeconds > 0) {
    filters.push(`fade=t=in:st=0:d=${transitionInSeconds.toFixed(3)}`);
  }
  if (transitionOutSeconds > 0) {
    const start = Math.max(0, targetDurationSeconds - transitionOutSeconds);
    filters.push(
      `fade=t=out:st=${start.toFixed(3)}:d=${transitionOutSeconds.toFixed(3)}`,
    );
  }
  return filters.join(",");
}

function encodeVideoArgs(
  input: string[],
  videoFilter: string,
  targetDuration: string,
  fps: number,
  output: string,
  videoEncoder: VideoEncoder,
): string[] {
  return [
    ...input,
    "-t",
    targetDuration,
    "-vf",
    videoFilter,
    "-r",
    String(fps),
    "-an",
    "-c:v",
    videoEncoder,
    "-pix_fmt",
    "yuv420p",
    "-y",
    output,
  ];
}

function segmentCacheKey(
  manifest: LocalRenderManifest,
  beat: LocalRenderBeat,
  videoEncoder: VideoEncoder,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        rendererVersion: "segment-render-v5",
        width: manifest.width,
        height: manifest.height,
        fps: manifest.fps,
        videoEncoder,
        beat: {
          visualBeatId: beat.visualBeatId,
          mediaAssetId: beat.mediaAssetId,
          mediaType: beat.mediaType,
          checksum: beat.checksum,
          durationMs: beat.durationMs,
          sourceDurationMs: beat.sourceDurationMs,
          fitMode: beat.fitMode,
          trimStartMs: beat.trimStartMs,
          cameraMovement: beat.cameraMovement,
          transitionInMs: beat.transitionInMs,
          transitionOutMs: beat.transitionOutMs,
        },
      }),
    )
    .digest("hex");
}

async function validCachedSegment(path: string): Promise<boolean> {
  try {
    const value = await stat(path);
    return value.isFile() && value.size > 0;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}
