import assert from "node:assert/strict";
import test from "node:test";
import { parseRenderProfile } from "../src/main/rendering/render-profile.ts";

test("legacy render profile stays reproducible with schema v1 defaults", () => {
  const profile = parseRenderProfile("{}");
  assert.equal(profile.schemaVersion, 1);
  assert.equal(profile.rendererVersion, "project-image-motion-v2-frame-quantized");
  assert.equal(profile.compositionPolicyVersion, 0);
  assert.equal(profile.fps, 30);
  assert.equal(profile.subtitleMode, "burn_in");
  assert.deepEqual(profile.video, {
    x264Preset: "veryfast",
    crf: 20,
    nvencPreset: "p5",
    nvencCq: 21,
    pixelFormat: "yuv420p",
  });
  assert.equal(profile.colorMode, "LEGACY_UNSPECIFIED");
});

test("render profile v2 preserves the explicit composition and quality contract", () => {
  const profile = parseRenderProfile(JSON.stringify({
    schemaVersion: 2,
    rendererVersion: "project-image-motion-v3-composition",
    compositionPolicyVersion: 1,
    fps: 60,
    video: {
      x264Preset: "medium",
      crf: 18,
      nvencPreset: "p6",
      nvencCq: 19,
      pixelFormat: "yuv420p",
    },
    color: { mode: "SDR_BT709_LIMITED" },
    subtitles: { mode: "none" },
  }));

  assert.equal(profile.schemaVersion, 2);
  assert.equal(profile.rendererVersion, "project-image-motion-v3-composition");
  assert.equal(profile.compositionPolicyVersion, 1);
  assert.equal(profile.fps, 60);
  assert.equal(profile.subtitleMode, "none");
  assert.deepEqual(profile.video, {
    x264Preset: "medium",
    crf: 18,
    nvencPreset: "p6",
    nvencCq: 19,
    pixelFormat: "yuv420p",
  });
  assert.equal(profile.colorMode, "SDR_BT709_LIMITED");
});

test("render profile v2 malformed quality fields fall back to v2 defaults", () => {
  const profile = parseRenderProfile(JSON.stringify({
    schemaVersion: 2,
    fps: 15,
    video: {
      x264Preset: "ultrafast",
      crf: -2,
      nvencPreset: "p1",
      nvencCq: 100,
      pixelFormat: "yuv444p",
    },
  }));

  assert.equal(profile.fps, 30);
  assert.deepEqual(profile.video, {
    x264Preset: "medium",
    crf: 18,
    nvencPreset: "p6",
    nvencCq: 19,
    pixelFormat: "yuv420p",
  });
});

test("unsupported future render profile schemas fail explicitly", () => {
  assert.throws(
    () => parseRenderProfile('{"schemaVersion":3}'),
    /Unsupported render profile schema/,
  );
});
