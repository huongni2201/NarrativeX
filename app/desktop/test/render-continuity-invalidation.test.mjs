import assert from "node:assert/strict";
import test from "node:test";

import { segmentCacheKey } from "../src/main/rendering/segment-cache-key.ts";

function manifest(overrides = {}) {
  return {
    rendererVersion: "project-image-motion-v3-composition",
    renderProfileSchemaVersion: 2,
    compositionPolicyVersion: 1,
    width: 1920,
    height: 1080,
    fps: 60,
    videoQuality: {
      preset: "medium",
      crf: 18,
      pixelFormat: "yuv420p",
    },
    colorMode: "SDR_BT709_LIMITED",
    subtitles: [],
    ...overrides,
  };
}

function beat(overrides = {}) {
  return {
    visualBeatId: "11111111-1111-1111-1111-111111111111",
    mediaAssetId: "22222222-2222-2222-2222-222222222222",
    mediaType: "IMAGE",
    checksum: "a".repeat(64),
    durationMs: 2000,
    sourceDurationMs: null,
    fitMode: "TRIM",
    framing: "COVER",
    trimStartMs: 0,
    cameraMovement: "PAN",
    motionEasing: "SMOOTHSTEP",
    startFrame: 0,
    endFrame: 120,
    frameCount: 120,
    transitionInMs: 0,
    transitionOutMs: 0,
    globalStartMs: 0,
    globalEndMs: 2000,
    ...overrides,
  };
}

test("segment cache ignores logical identity and absolute timeline position", () => {
  const base = segmentCacheKey(manifest(), beat(), "libx264");
  const regeneratedIdentity = segmentCacheKey(
    manifest(),
    beat({
      visualBeatId: "33333333-3333-3333-3333-333333333333",
      mediaAssetId: "44444444-4444-4444-4444-444444444444",
      startFrame: 600,
      endFrame: 720,
      globalStartMs: 10_000,
      globalEndMs: 12_000,
    }),
    "libx264",
  );

  assert.equal(regeneratedIdentity, base);
});

test("segment cache invalidates when an effective render dependency changes", () => {
  const base = segmentCacheKey(manifest(), beat(), "libx264");

  assert.notEqual(
    segmentCacheKey(manifest(), beat({ checksum: "b".repeat(64) }), "libx264"),
    base,
  );
  assert.notEqual(segmentCacheKey(manifest(), beat({ cameraMovement: "ZOOM_IN" }), "libx264"), base);
  assert.notEqual(segmentCacheKey(manifest(), beat({ frameCount: 121, durationMs: 2017 }), "libx264"), base);
  assert.notEqual(segmentCacheKey(manifest({ width: 1280, height: 720 }), beat(), "libx264"), base);
  assert.notEqual(segmentCacheKey(manifest(), beat(), "h264_nvenc"), base);
});
