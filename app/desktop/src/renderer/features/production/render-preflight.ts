import type {
  DesktopTimeline,
  LocalRenderPreflightAssetInput,
  RenderFrameRate,
  RenderResolution,
} from "@narrativex/client-contracts";
import type { LocalRenderPreflightInput } from "../../../preload/types";

export function buildRenderPreflightInput(
  projectId: string,
  timeline: DesktopTimeline,
  resolution: RenderResolution,
  frameRate: RenderFrameRate = 30,
): LocalRenderPreflightInput {
  const assets: LocalRenderPreflightAssetInput[] = [];

  for (const beat of timeline.beats) {
    if (!beat.mediaAssetId) continue;
    assets.push({ assetId: beat.mediaAssetId });
  }

  for (const chapter of timeline.chapters) {
    if (!chapter.narrationAssetId) continue;
    assets.push({ assetId: chapter.narrationAssetId });
  }

  const estimatedOutputBytes = estimateRenderOutputBytes(
    timeline.totalDurationMs,
    resolution,
    frameRate,
  );
  const assetIds = [...new Set(assets.map((asset) => asset.assetId))];

  return {
    projectId,
    assetIds,
    assets,
    estimatedOutputBytes,
    requiredTemporaryBytes: estimatedOutputBytes * 2,
  };
}

export function estimateRenderOutputBytes(
  totalDurationMs: number,
  resolution: RenderResolution,
  frameRate: RenderFrameRate = 30,
): number {
  const frameRateFactor = frameRate / 30;
  return Math.max(
    64 * 1024 * 1024,
    Math.round(
      (Math.max(0, totalDurationMs) / 1000) * bitrateEstimateFor(resolution) * frameRateFactor,
    ),
  );
}

function bitrateEstimateFor(resolution: RenderResolution): number {
  switch (resolution) {
    case "1440p":
      return 3_500_000;
    case "1080p":
      return 2_200_000;
    default:
      return 1_500_000;
  }
}
