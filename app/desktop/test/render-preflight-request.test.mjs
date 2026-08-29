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
        storageMode: "LOCAL_ONLY",
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

test("preflight request distinguishes local media from remote narration", () => {
  const result = buildRenderPreflightInput("project-1", timeline(), "1080p");
  assert.deepEqual(result.assets, [
    { assetId: "image-1", storageMode: "LOCAL_ONLY", materializable: false },
    { assetId: "audio-1", storageMode: "REMOTE", materializable: true },
  ]);
  assert.equal(result.estimatedOutputBytes, estimateRenderOutputBytes(60_000, "1080p"));
  assert.equal(result.requiredTemporaryBytes, result.estimatedOutputBytes * 2);
});

test("remote and hybrid beat media are materializable", () => {
  const remote = timeline();
  remote.beats = [
    { ...remote.beats[0], mediaAssetId: "remote-image", storageMode: "REMOTE" },
    { ...remote.beats[0], visualBeatId: "beat-2", mediaAssetId: "hybrid-video", mediaType: "VIDEO", storageMode: "HYBRID" },
  ];
  const result = buildRenderPreflightInput("project-1", remote, "1440p");
  assert.deepEqual(result.assets.slice(0, 2), [
    { assetId: "remote-image", storageMode: "REMOTE", materializable: true },
    { assetId: "hybrid-video", storageMode: "HYBRID", materializable: true },
  ]);
});
