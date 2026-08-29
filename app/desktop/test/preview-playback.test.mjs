import test from "node:test";
import assert from "node:assert/strict";
import {
  globalPlayheadFromNarrationSeconds,
  imageTransformForBeat,
  narrationSeekSeconds,
  narrationTimeMs,
  previewPlaybackState,
  shouldResyncNarration,
  shouldUseFallbackPlaybackClock,
} from "../src/renderer/features/editor/preview-playback.ts";

function beat(overrides = {}) {
  return {
    chapterId: "chapter-1",
    sceneIndex: 0,
    beatIndex: 0,
    visualBeatId: "beat-1",
    title: "Beat",
    visualIntent: "Intent",
    cameraMovement: "NONE",
    assetStrategy: "GENERATE",
    mediaAssetId: "asset-1",
    mediaType: "VIDEO",
    storageMode: "REMOTE",
    sourceDurationMs: 10_000,
    fitMode: "TRIM",
    trimStartMs: 1_000,
    mediaSelectionActive: false,
    startMs: 5_000,
    endMs: 10_000,
    durationMs: 5_000,
    assetReady: true,
    ...overrides,
  };
}

test("trim preview maps global playhead to source time", () => {
  const state = previewPlaybackState(beat(), 7_000);
  assert.equal(state.mediaTimeMs, 3_000);
  assert.equal(state.playbackRate, 1);
  assert.equal(state.shouldPlayVideo, true);
});

test("loop preview wraps short source media", () => {
  const state = previewPlaybackState(
    beat({ sourceDurationMs: 3_000, trimStartMs: 0, fitMode: "LOOP", durationMs: 8_000, endMs: 13_000 }),
    12_000,
  );
  assert.equal(state.mediaTimeMs, 1_000);
});

test("freeze end stops video while global clock continues", () => {
  const state = previewPlaybackState(
    beat({ sourceDurationMs: 3_000, trimStartMs: 0, fitMode: "FREEZE_END", durationMs: 8_000, endMs: 13_000 }),
    12_000,
  );
  assert.equal(state.shouldPlayVideo, false);
  assert.ok(state.mediaTimeMs < 3_000);
});

test("speed adjust maps narration duration over available source", () => {
  const state = previewPlaybackState(
    beat({ sourceDurationMs: 8_000, trimStartMs: 0, fitMode: "SPEED_ADJUST", durationMs: 10_000, endMs: 15_000 }),
    10_000,
  );
  assert.equal(state.playbackRate, 0.8);
  assert.equal(state.mediaTimeMs, 4_000);
});

test("image motion is deterministic and narration is chapter relative", () => {
  assert.match(
    imageTransformForBeat({ cameraMovement: "PUSH_IN", durationMs: 10_000 }, 5_000),
    /^scale\(1\.04/,
  );
  assert.equal(narrationTimeMs(15_000, 10_000, 20_000), 5_000);
  assert.equal(narrationTimeMs(25_000, 10_000, 20_000), 10_000);
});

test("narration seconds are the authoritative global playhead", () => {
  assert.equal(globalPlayheadFromNarrationSeconds(12.25, 30_000, 50_000), 42_250);
  assert.equal(globalPlayheadFromNarrationSeconds(99, 30_000, 50_000), 50_000);
  assert.equal(globalPlayheadFromNarrationSeconds(-1, 30_000, 50_000), 30_000);
});

test("timeline seek maps back to chapter-local narration seconds", () => {
  assert.equal(narrationSeekSeconds(42_250, 30_000, 50_000), 12.25);
  assert.equal(narrationSeekSeconds(25_000, 30_000, 50_000), 0);
  assert.equal(narrationSeekSeconds(55_000, 30_000, 50_000), 20);
});

test("live narration resyncs once drift exceeds 100 ms", () => {
  assert.equal(shouldResyncNarration(12.0, 12.09), false);
  assert.equal(shouldResyncNarration(12.0, 12.11), true);
  assert.equal(shouldResyncNarration(20.0, 5.0), true);
});

test("fallback clock stays off while narration is authoritative", () => {
  assert.equal(
    shouldUseFallbackPlaybackClock({
      playing: true,
      hasNarration: true,
      narrationClockFailed: false,
    }),
    false,
  );
});

test("fallback clock runs only without usable narration", () => {
  assert.equal(
    shouldUseFallbackPlaybackClock({
      playing: true,
      hasNarration: false,
      narrationClockFailed: false,
    }),
    true,
  );
  assert.equal(
    shouldUseFallbackPlaybackClock({
      playing: true,
      hasNarration: true,
      narrationClockFailed: true,
    }),
    true,
  );
  assert.equal(
    shouldUseFallbackPlaybackClock({
      playing: false,
      hasNarration: false,
      narrationClockFailed: false,
    }),
    false,
  );
});
