import test from "node:test";
import assert from "node:assert/strict";
import { resetTimelineDraft, timelineOverrides, updateTimelineDraft } from "../src/renderer/features/production/timeline-draft.ts";

test("timeline draft merges visual overrides and exports only active beats", () => {
  let draft = updateTimelineDraft({}, "beat-1", { cameraMovement: "PAN" });
  draft = updateTimelineDraft(draft, "beat-1", { fitMode: "FREEZE_END" });
  assert.deepEqual(timelineOverrides(draft), [{ visualBeatId: "beat-1", cameraMovement: "PAN", fitMode: "FREEZE_END" }]);
  assert.deepEqual(resetTimelineDraft(draft, "beat-1"), {});
});

test("timeline draft removes empty override", () => {
  const draft = updateTimelineDraft({ "beat-1": { visualBeatId: "beat-1", cameraMovement: "PAN" } }, "beat-1", { cameraMovement: undefined });
  assert.deepEqual(draft, {});
});
