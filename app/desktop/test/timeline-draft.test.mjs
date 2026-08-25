import test from "node:test";
import assert from "node:assert/strict";
import { resetTimelineDraft, timelineOverrides, updateTimelineDraft } from "../src/renderer/features/production/timeline-draft.ts";

test("timeline draft merges overrides and exports only active beats", () => {
  let draft = updateTimelineDraft({}, "beat-1", { durationMs: 1200 });
  draft = updateTimelineDraft(draft, "beat-1", { cameraMovement: "PAN" });
  assert.deepEqual(timelineOverrides(draft), [{ visualBeatId: "beat-1", durationMs: 1200, cameraMovement: "PAN" }]);
  assert.deepEqual(resetTimelineDraft(draft, "beat-1"), {});
});

test("timeline draft removes empty override", () => {
  const draft = updateTimelineDraft({ "beat-1": { visualBeatId: "beat-1", durationMs: 1200 } }, "beat-1", { durationMs: undefined });
  assert.deepEqual(draft, {});
});
