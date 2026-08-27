import test from "node:test";
import assert from "node:assert/strict";
import { applyTimelineCommand } from "../src/renderer/features/production/timeline-commands.ts";

test("timeline commands are deterministic and resettable", () => {
  let draft = applyTimelineCommand({}, { type: "SET_DURATION", visualBeatId: "b1", durationMs: 1333.4 });
  draft = applyTimelineCommand(draft, { type: "SET_CAMERA", visualBeatId: "b1", cameraMovement: " PAN " });
  draft = applyTimelineCommand(draft, { type: "SET_FIT", visualBeatId: "b1", fitMode: "FREEZE_END" });
  draft = applyTimelineCommand(draft, { type: "SET_TRIM_START", visualBeatId: "b1", trimStartMs: 1250.4 });
  assert.deepEqual(draft.b1, {
    visualBeatId: "b1",
    durationMs: 1333,
    cameraMovement: "PAN",
    fitMode: "FREEZE_END",
    trimStartMs: 1250,
  });
  assert.deepEqual(applyTimelineCommand(draft, { type: "RESET_BEAT", visualBeatId: "b1" }), {});
});

test("timeline duration and trim reject pathological values", () => {
  assert.throws(() => applyTimelineCommand({}, { type: "SET_DURATION", visualBeatId: "b1", durationMs: 10 }), RangeError);
  assert.throws(() => applyTimelineCommand({}, { type: "SET_TRIM_START", visualBeatId: "b1", trimStartMs: -1 }), RangeError);
});

test("reset all does not mutate previous draft", () => {
  const draft = applyTimelineCommand({}, { type: "SET_DURATION", visualBeatId: "b1", durationMs: 1000 });
  assert.deepEqual(applyTimelineCommand(draft, { type: "RESET_ALL" }), {});
  assert.equal(draft.b1.durationMs, 1000);
});
