import test from "node:test";
import assert from "node:assert/strict";
import { storyboardApi } from "../src/renderer/features/storyboard/api/storyboard.api.ts";
import { approveVisualBeats } from "../src/renderer/features/storyboard/queries/storyboard.queries.ts";

test("approveVisualBeats preserves partial success counts and row-version inputs", async () => {
  const original = storyboardApi.updateReviewStatus;
  const calls = [];
  storyboardApi.updateReviewStatus = async (...args) => {
    calls.push(args);
    if (args[3] === "beat-2") throw new Error("stale row version");
    return { id: args[3] };
  };

  try {
    const result = await approveVisualBeats("project-1", "chapter-1", [
      { id: "beat-1", sceneId: "scene-1", rowVersion: 3 },
      { id: "beat-2", sceneId: "scene-1", rowVersion: 8 },
    ]);

    assert.deepEqual(result, { approved: 1, failed: 1 });
    assert.deepEqual(calls, [
      ["project-1", "chapter-1", "scene-1", "beat-1", 3, "APPROVED"],
      ["project-1", "chapter-1", "scene-1", "beat-2", 8, "APPROVED"],
    ]);
  } finally {
    storyboardApi.updateReviewStatus = original;
  }
});
