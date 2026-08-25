import test from "node:test";
import assert from "node:assert/strict";
import { applyTimelineCommand } from "../src/renderer/features/production/timeline-commands.ts";

test("timeline commands are deterministic and resettable", () => {
  let draft = applyTimelineCommand({}, { type: "SET_DURATION", visualBeatId: "b1", durationMs: 1333.4 });
  draft = applyTimelineCommand(draft, { type: "SET_CAMERA", visualBeatId: "b1", cameraMovement: " PAN " });
  draft = applyTimelineCommand(draft, { type: "SET_MEDIA", visualBeatId: "b1", mediaAssetId: "asset-1" });
  assert.deepEqual(draft.b1, { visualBeatId: "b1", durationMs: 1333, cameraMovement: "PAN", mediaAssetId: "asset-1" });
  assert.deepEqual(applyTimelineCommand(draft, { type: "RESET_BEAT", visualBeatId: "b1" }), {});
});

test("timeline duration rejects pathological clips", () => {
  assert.throws(() => applyTimelineCommand({}, { type: "SET_DURATION", visualBeatId: "b1", durationMs: 10 }), RangeError);
});

test("reset all does not mutate previous draft", () => {
  const draft = applyTimelineCommand({}, { type: "SET_DURATION", visualBeatId: "b1", durationMs: 1000 });
  assert.deepEqual(applyTimelineCommand(draft, { type: "RESET_ALL" }), {});
  assert.equal(draft.b1.durationMs, 1000);
});
