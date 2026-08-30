import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalRenderManifest } from "../src/main/rendering/render-manifest.ts";

function claimedRender(subtitleMode) {
  return {
    jobId: "00000000-0000-7000-8000-000000000001",
    projectId: "00000000-0000-7000-8000-000000000002",
    storyVersionId: "00000000-0000-7000-8000-000000000003",
    resolution: "1080p",
    format: "mp4",
    aspectRatio: "16:9",
    totalDurationMs: 2_000,
    renderProfileJson: JSON.stringify({
      schemaVersion: 1,
      fps: 30,
      subtitles: { mode: subtitleMode },
    }),
    leaseToken: "00000000-0000-7000-8000-000000000004",
    chapters: [
      {
        chapterId: "00000000-0000-7000-8000-000000000005",
        orderIndex: 0,
        globalStartMs: 0,
        globalEndMs: 2_000,
        narrationAssetId: "00000000-0000-7000-8000-000000000006",
        downloadUrl: null,
        sizeBytes: 100,
        checksum: "a".repeat(64),
        durationMs: 2_000,
        subtitleText: "Xin chào thế giới",
        subtitleSpansJson: null,
        localPath: "/tmp/audio.mp3",
      },
    ],
    beats: [
      {
        chapterId: "00000000-0000-7000-8000-000000000005",
        sceneIndex: 0,
        beatIndex: 0,
        visualBeatId: "00000000-0000-7000-8000-000000000007",
        mediaAssetId: "00000000-0000-7000-8000-000000000008",
        globalStartMs: 0,
        globalEndMs: 2_000,
        durationMs: 2_000,
        cameraMovement: "NONE",
        mediaType: "IMAGE",
        storageMode: "LOCAL_ONLY",
        sourceDurationMs: null,
        fitMode: "TRIM",
        trimStartMs: 0,
        downloadUrl: null,
        sizeBytes: 100,
        checksum: "b".repeat(64),
        localPath: "/tmp/image.png",
      },
    ],
  };
}

test("render manifest omits subtitles when subtitle mode is none", () => {
  const manifest = buildLocalRenderManifest(claimedRender("none"));
  assert.deepEqual(manifest.subtitles, []);
});

test("render manifest plans subtitles when subtitle mode is burn_in", () => {
  const manifest = buildLocalRenderManifest(claimedRender("burn_in"));
  assert.ok(manifest.subtitles.length > 0);
});
