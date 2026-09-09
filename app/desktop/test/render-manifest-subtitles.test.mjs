import assert from "node:assert/strict";
import test from "node:test";
import { parseRenderProfile } from "../src/main/rendering/render-profile.ts";

test("render profile v3 preserves the explicit composition, quality, and watermark contract", () => {
  const profile = parseRenderProfile(JSON.stringify({
    schemaVersion: 3,
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
    watermark: { mode: "required", policyVersion: 1 },
  }));

  assert.equal(profile.schemaVersion, 3);
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
  assert.deepEqual(profile.watermark, { mode: "required", policyVersion: 1 });
});

test("render profile v3 malformed quality fields fall back to current defaults", () => {
  const profile = parseRenderProfile(JSON.stringify({
    schemaVersion: 3,
    fps: 15,
    video: {
      x264Preset: "ultrafast",
      crf: -2,
      nvencPreset: "p1",
      nvencCq: 100,
      pixelFormat: "yuv444p",
    },
    watermark: { mode: "none", policyVersion: 1 },
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

test("invalid, legacy, or policy-free render profiles fail explicitly after the v3 cutover", () => {
  assert.throws(() => parseRenderProfile("{}"), /Unsupported render profile schema/);
  assert.throws(() => parseRenderProfile("not-json"), /Invalid render profile JSON/);
  assert.throws(
    () => parseRenderProfile('{"schemaVersion":2}'),
    /Unsupported render profile schema/,
  );
  assert.throws(
    () => parseRenderProfile('{"schemaVersion":3}'),
    /Invalid render watermark policy/,
  );
});
