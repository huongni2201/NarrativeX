import test from "node:test";
import assert from "node:assert/strict";
import { validateRenderSync } from "../src/main/rendering/render-sync-validation.ts";

const base = {
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
    () => validateRenderSync({ ...base, videoDurationMs: 10_500 }, 10_000, 60),
    /video duration/i,
  );
});
