import { createHash } from "node:crypto";
import { copyFile, mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { imageMotionPreset } from "../../shared/image-motion.ts";
import { SUBTITLE_STYLE_VERSION } from "../../shared/subtitle-style.ts";
import { buildVideoEncodeArgs, type VideoEncoder } from "../../shared/video-encoding.ts";
import type { LocalRenderManifest, LocalRenderBeat } from "./render-manifest";
import { runProcess, type ProcessResult } from "./process-runner";
import { RenderExecutionError } from "./render-errors";
import {
  escapeSubtitleFilterPath,
  subtitleSlicesForBeat,
  writeBeatSubtitleTrack,
} from "./subtitle-ass.ts";

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
  const videoEncoder = options.videoEncoder ?? manifest.videoEncoder;
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

      const subtitlePath = await writeBeatSubtitleTrack(workDirectory, manifest, beat, index);
      const args = buildBeatRenderArgs(manifest, beat, output, videoEncoder, subtitlePath);
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

export function buildBeatRenderArgs(
  manifest: LocalRenderManifest,
  beat: LocalRenderBeat,
  output: string,
  videoEncoder: VideoEncoder = manifest.videoEncoder,
  subtitlePath: string | null = null,
): string[] {
  const targetDurationSeconds = beat.frameCount / manifest.fps;
  if (!Number.isFinite(targetDurationSeconds) || targetDurationSeconds <= 0 || beat.frameCount <= 0) {
    throw new RenderExecutionError(
      "INVALID_BEAT_DURATION",
      `Visual beat ${beat.visualBeatId} has an invalid narration duration.`,
    );
  }

  const baseFilter =
    `scale=${manifest.width}:${manifest.height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
    `pad=${manifest.width}:${manifest.height}:(ow-iw)/2:(oh-ih)/2,` +
    `fps=${manifest.fps}`;

  if (beat.mediaType === "IMAGE") {
    const filter = withSubtitleFilter(
      withTransitionFilters(imageMotionFilter(manifest, beat), beat, manifest.fps),
      subtitlePath,
    );
    return [
      "-i",
      beat.localPath,
      "-vf",
      filter,
      "-frames:v",
      String(beat.frameCount),
      "-r",
      String(manifest.fps),
      "-an",
      ...buildVideoEncodeArgs(videoEncoder, manifest.videoQuality),
      ...colorMetadataArgs(manifest),
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
        withSubtitleFilter(withTransitionFilters(baseFilter, beat, manifest.fps), subtitlePath),
        beat.frameCount,
        manifest,
        output,
        videoEncoder,
      );
    }
    case "LOOP":
      return encodeVideoArgs(
        ["-stream_loop", "-1", ...inputSeek, "-i", beat.localPath],
        withSubtitleFilter(withTransitionFilters(baseFilter, beat, manifest.fps), subtitlePath),
        beat.frameCount,
        manifest,
        output,
        videoEncoder,
      );
    case "FREEZE_END": {
      const filter = withSubtitleFilter(
        withTransitionFilters(
          `${baseFilter},tpad=stop_mode=clone:stop_duration=${targetDurationSeconds.toFixed(6)}`,
          beat,
          manifest.fps,
        ),
        subtitlePath,
      );
      return encodeVideoArgs(
        [...inputSeek, "-i", beat.localPath],
        filter,
        beat.frameCount,
        manifest,
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
      const filter = withSubtitleFilter(
        withTransitionFilters(
          `scale=${manifest.width}:${manifest.height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
            `pad=${manifest.width}:${manifest.height}:(ow-iw)/2:(oh-ih)/2,` +
            `setpts=${ptsFactor.toFixed(8)}*PTS,fps=${manifest.fps}`,
          beat,
          manifest.fps,
        ),
        subtitlePath,
      );
      return encodeVideoArgs(
        [...inputSeek, "-i", beat.localPath],
        filter,
        beat.frameCount,
        manifest,
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

export function renderWorkingDimensions(
  width: number,
  height: number,
  moving: boolean,
  cameraMovement = "NONE",
  fps: 30 | 60 = 30,
): { width: number; height: number } {
  if (!moving) return { width: even(width), height: even(height) };
  const movement = cameraMovement.trim().toUpperCase();
  const factor =
    fps === 60 && (movement === "PAN" || movement === "TILT")
      ? 2
      : movement === "PAN" || movement === "TILT"
        ? 1.5
        : 1.25;
  let workingWidth = even(width * factor);
  let workingHeight = even(height * factor);
  const longEdge = Math.max(workingWidth, workingHeight);
  if (longEdge > 5120) {
    const ratio = 5120 / longEdge;
    workingWidth = even(workingWidth * ratio);
    workingHeight = even(workingHeight * ratio);
  }
  return {
    width: Math.max(even(width), workingWidth),
    height: Math.max(even(height), workingHeight),
  };
}

function imageMotionFilter(manifest: LocalRenderManifest, beat: LocalRenderBeat): string {
  const moving = beat.cameraMovement?.trim().toUpperCase() !== "NONE";
  const working = renderWorkingDimensions(
    manifest.width,
    manifest.height,
    moving,
    beat.cameraMovement,
    manifest.fps,
  );
  if (!moving) {
    return [
      `scale=${manifest.width}:${manifest.height}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${manifest.width}:${manifest.height}`,
      `fps=${manifest.fps}`,
      "setsar=1",
      `format=${manifest.videoQuality.pixelFormat}`,
    ].join(",");
  }

  const frameProgress = `(on/${Math.max(1, beat.frameCount - 1)})`;
  const easedProgress = `((${frameProgress})*(${frameProgress})*(3-2*(${frameProgress})))`;
  const preset = imageMotionPreset(beat.cameraMovement);
  const zoom = linearExpression(preset.zoomStart, preset.zoomEnd, easedProgress);
  const panX = linearExpression(preset.panXStart, preset.panXEnd, easedProgress);
  const panY = linearExpression(preset.panYStart, preset.panYEnd, easedProgress);
  const x = `(iw-iw/zoom)*(0.5+0.5*(${panX}))`;
  const y = `(ih-ih/zoom)*(0.5+0.5*(${panY}))`;

  return [
    "format=gbrp",
    `scale=${working.width}:${working.height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${working.width}:${working.height}`,
    `zoompan=z='${zoom}':x='${x}':y='${y}':d=${beat.frameCount}:s=${working.width}x${working.height}:fps=${manifest.fps}`,
    `scale=${manifest.width}:${manifest.height}:flags=lanczos`,
    "setsar=1",
    `format=${manifest.videoQuality.pixelFormat}`,
  ].join(",");
}

function linearExpression(start: number, end: number, progress: string): string {
  const delta = end - start;
  if (Math.abs(delta) < 0.0000001) return start.toFixed(6);
  return `${start.toFixed(6)}+${delta.toFixed(6)}*${progress}`;
}

function withTransitionFilters(
  videoFilter: string,
  beat: LocalRenderBeat,
  fps: number,
): string {
  const filters = [videoFilter];
  const maxTransitionFrames = Math.floor(beat.frameCount / 2);
  const transitionInFrames = Math.min(
    maxTransitionFrames,
    Math.max(0, Math.round((beat.transitionInMs * fps) / 1000)),
  );
  const transitionOutFrames = Math.min(
    maxTransitionFrames,
    Math.max(0, Math.round((beat.transitionOutMs * fps) / 1000)),
  );
  if (transitionInFrames > 0) {
    filters.push(`fade=t=in:s=0:n=${transitionInFrames}`);
  }
  if (transitionOutFrames > 0) {
    const startFrame = Math.max(0, beat.frameCount - transitionOutFrames);
    filters.push(`fade=t=out:s=${startFrame}:n=${transitionOutFrames}`);
  }
  return filters.join(",");
}

function withSubtitleFilter(videoFilter: string, subtitlePath: string | null): string {
  if (!subtitlePath) return videoFilter;
  return `${videoFilter},subtitles=filename='${escapeSubtitleFilterPath(subtitlePath)}'`;
}

function encodeVideoArgs(
  input: string[],
  videoFilter: string,
  frameCount: number,
  manifest: LocalRenderManifest,
  output: string,
  videoEncoder: VideoEncoder,
): string[] {
  return [
    ...input,
    "-vf",
    videoFilter,
    "-frames:v",
    String(frameCount),
    "-r",
    String(manifest.fps),
    "-an",
    ...buildVideoEncodeArgs(videoEncoder, manifest.videoQuality),
    ...colorMetadataArgs(manifest),
    "-y",
    output,
  ];
}

function colorMetadataArgs(manifest: LocalRenderManifest): string[] {
  if (manifest.colorMode !== "SDR_BT709_LIMITED") return [];
  return [
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
  ];
}

function segmentCacheKey(
  manifest: LocalRenderManifest,
  beat: LocalRenderBeat,
  videoEncoder: VideoEncoder,
): string {
  const moving = beat.mediaType === "IMAGE" && beat.cameraMovement?.trim().toUpperCase() !== "NONE";
  const working = renderWorkingDimensions(
    manifest.width,
    manifest.height,
    moving,
    beat.cameraMovement,
    manifest.fps,
  );
  const subtitles = subtitleSlicesForBeat(manifest.subtitles, beat, manifest.fps);
  return createHash("sha256")
    .update(
      JSON.stringify({
        rendererVersion: manifest.rendererVersion,
        renderProfileSchemaVersion: manifest.renderProfileSchemaVersion,
        compositionPolicyVersion: manifest.compositionPolicyVersion,
        adapter: "zoompan-rgb-adaptive-supersample-lanczos-ass-v1",
        subtitleStyleVersion: SUBTITLE_STYLE_VERSION,
        subtitles,
        width: manifest.width,
        height: manifest.height,
        working,
        fps: manifest.fps,
        videoEncoder,
        videoQuality: manifest.videoQuality,
        colorMode: manifest.colorMode,
        beat: {
          visualBeatId: beat.visualBeatId,
          mediaAssetId: beat.mediaAssetId,
          mediaType: beat.mediaType,
          checksum: beat.checksum,
          durationMs: beat.durationMs,
          sourceDurationMs: beat.sourceDurationMs,
          fitMode: beat.fitMode,
          framing: beat.framing,
          trimStartMs: beat.trimStartMs,
          cameraMovement: beat.cameraMovement,
          motionEasing: beat.motionEasing,
          startFrame: beat.startFrame,
          endFrame: beat.endFrame,
          frameCount: beat.frameCount,
          transitionInMs: beat.transitionInMs,
          transitionOutMs: beat.transitionOutMs,
        },
      }),
    )
    .digest("hex");
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
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
