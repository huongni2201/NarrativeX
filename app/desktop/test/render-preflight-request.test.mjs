import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRenderPreflightInput,
  estimateRenderOutputBytes,
} from "../src/renderer/features/production/render-preflight.ts";

function timeline() {
  return {
    projectId: "project-1",
    storyVersionId: "story-1",
    totalDurationMs: 60_000,
    aspectRatio: "16:9",
    readyForRender: true,
    chapters: [
      {
        chapterId: "chapter-1",
        orderIndex: 0,
        title: "Chapter 1",
        startMs: 0,
        endMs: 60_000,
        audioReady: true,
        readyForRender: true,
        narrationAssetId: "audio-1",
        audioSizeBytes: 1234,
        audioChecksum: "a".repeat(64),
      },
    ],
    beats: [
      {
        chapterId: "chapter-1",
        sceneIndex: 0,
        beatIndex: 0,
        visualBeatId: "beat-1",
        title: "Beat 1",
        visualIntent: "Visual",
        cameraMovement: "NONE",
        assetStrategy: "GENERATE_NEW",
        mediaAssetId: "image-1",
        mediaType: "IMAGE",
        sourceDurationMs: null,
        fitMode: "TRIM",
        trimStartMs: 0,
        mediaSelectionActive: false,
        startMs: 0,
        endMs: 60_000,
        durationMs: 60_000,
        assetReady: true,
      },
    ],
  };
}

test("preflight request carries only local project asset identities", () => {
  const result = buildRenderPreflightInput("project-1", timeline(), "1080p");
  assert.deepEqual(result.assets, [
    { assetId: "image-1" },
    { assetId: "audio-1" },
  ]);
  assert.equal(result.estimatedOutputBytes, estimateRenderOutputBytes(60_000, "1080p"));
  assert.equal(result.requiredTemporaryBytes, result.estimatedOutputBytes * 2);
});

test("multiple visual assets stay storage-mode free", () => {
  const local = timeline();
  local.beats = [
    { ...local.beats[0], mediaAssetId: "image-2" },
    { ...local.beats[0], visualBeatId: "beat-2", mediaAssetId: "video-1", mediaType: "VIDEO" },
  ];
  const result = buildRenderPreflightInput("project-1", local, "1440p");
  assert.deepEqual(result.assets.slice(0, 2), [
    { assetId: "image-2" },
    { assetId: "video-1" },
  ]);
});
