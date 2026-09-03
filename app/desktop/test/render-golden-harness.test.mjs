import assert from "node:assert/strict";
import test from "node:test";
import {
  GOLDEN_ENCODERS,
  GOLDEN_FIXTURES,
  GOLDEN_FRAME_RATES,
  GOLDEN_RESOLUTIONS,
  runGoldenSmoke,
} from "../scripts/render-golden-harness.mjs";

test("golden matrix covers motion, crop, transition, subtitle, fps, resolution and encoder cases", () => {
  assert.deepEqual(GOLDEN_FRAME_RATES, [30, 60]);
  assert.deepEqual(GOLDEN_RESOLUTIONS, [[1920, 1080], [2560, 1440]]);
  assert.deepEqual(GOLDEN_ENCODERS, ["libx264", "h264_nvenc"]);
  for (const fixture of ["static-image", "slow-push-in", "horizontal-pan", "portrait-crop", "landscape-crop", "scene-transition", "subtitle-boundary"]) {
    assert.ok(GOLDEN_FIXTURES.includes(fixture));
  }
});

test("golden smoke creates and probes a real 60fps encoded video when ffmpeg is available", async (t) => {
  const metrics = await runGoldenSmoke();
  if (!metrics) {
    t.skip("ffmpeg/ffprobe are not available in this Desktop test environment");
    return;
  }
  assert.equal(metrics.frameCount, 120);
  assert.equal(metrics.width, 1280);
  assert.equal(metrics.height, 720);
  assert.ok(Math.abs(metrics.durationSeconds - 2) < 0.15);
  assert.ok(metrics.renderFps > 0);
  assert.ok(metrics.outputSizeBytes > 0);
  assert.ok(metrics.bitrate > 0);
});
