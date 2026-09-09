import { createHash } from "node:crypto";
import { SUBTITLE_STYLE_VERSION } from "../../shared/subtitle-style.ts";
import type { VideoEncoder } from "../../shared/video-encoding.ts";
import type { LocalRenderBeat, LocalRenderManifest } from "./render-manifest";
import { renderWorkingDimensions } from "./render-working-dimensions.ts";
import { subtitleSlicesForBeat } from "./subtitle-ass.ts";

const SEGMENT_ADAPTER_VERSION = "zoompan-rgb-adaptive-supersample-lanczos-ass-watermark-v2";

/**
 * Fingerprint only inputs that can affect encoded pixels for one segment.
 * Logical identity (job/beat/media ids) and absolute timeline position are deliberately excluded.
 */
export function segmentCacheKey(
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
        adapter: SEGMENT_ADAPTER_VERSION,
        subtitleStyleVersion: SUBTITLE_STYLE_VERSION,
        subtitles,
        width: manifest.width,
        height: manifest.height,
        working,
        fps: manifest.fps,
        videoEncoder,
        videoQuality: manifest.videoQuality,
        colorMode: manifest.colorMode,
        watermark: manifest.watermark,
        media: {
          mediaType: beat.mediaType,
          checksum: beat.checksum,
          durationMs: beat.durationMs,
          sourceDurationMs: beat.sourceDurationMs,
          fitMode: beat.fitMode,
          framing: beat.framing,
          trimStartMs: beat.trimStartMs,
          cameraMovement: beat.cameraMovement,
          motionEasing: beat.motionEasing,
          frameCount: beat.frameCount,
          transitionInMs: beat.transitionInMs,
          transitionOutMs: beat.transitionOutMs,
        },
      }),
    )
    .digest("hex");
}
