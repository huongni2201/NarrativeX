import test from "node:test";
import assert from "node:assert/strict";
import { validateRenderSync } from "../src/main/rendering/render-sync-validation.ts";

const base = {
  fps: 30,
  width: 1280,
  height: 720,
  durationMs: 10_000,
  videoStartMs: 0,
  videoDurationMs: 10_000,
  audioStartMs: 0,
  audioDurationMs: 10_000,
};

test("render sync validation accepts frame-sized mux rounding", () => {
  assert.doesNotThrow(() =>
    validateRenderSync(
      {
        ...base,
        videoDurationMs: 10_017,
        audioStartMs: 21,
        audioDurationMs: 9_984,
      },
      10_000,
      30,
    ),
  );
});

test("render sync validation rejects audio that starts visibly late", () => {
  assert.throws(
    () => validateRenderSync({ ...base, audioStartMs: 250 }, 10_000, 30),
    /audio starts .* master clock/i,
  );
});

test("render sync validation rejects audio duration drift", () => {
  assert.throws(
    () => validateRenderSync({ ...base, audioDurationMs: 9_500 }, 10_000, 30),
    /audio duration/i,
  );
});

test("render sync validation rejects video duration drift", () => {
  assert.throws(
    () => validateRenderSync({ ...base, fps: 60, videoDurationMs: 10_500 }, 10_000, 60),
    /video duration/i,
  );
});

test("render verification rejects a different frame rate from the immutable profile", () => {
  assert.throws(() => validateRenderSync(base, 10_000, 24), /frame rate/i);
});

test("render verification rejects different dimensions from the immutable profile", () => {
  assert.throws(
    () => validateRenderSync(base, 10_000, 30, { width: 1920, height: 1080 }),
    /dimensions/i,
  );
});
