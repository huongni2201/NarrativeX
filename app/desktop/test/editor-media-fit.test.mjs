import test from "node:test";
import assert from "node:assert/strict";
import { getAllowedBeatFitModes } from "../src/renderer/features/editor/model/editor-media-fit.ts";

test("image media only allows TRIM", () => {
  assert.deepEqual(getAllowedBeatFitModes("IMAGE"), ["TRIM"]);
});

test("video media allows all supported production fit modes", () => {
  assert.deepEqual(getAllowedBeatFitModes("VIDEO"), [
    "TRIM",
    "LOOP",
    "FREEZE_END",
    "SPEED_ADJUST",
  ]);
});

test("missing media only exposes the safe default", () => {
  assert.deepEqual(getAllowedBeatFitModes(null), ["TRIM"]);
});
