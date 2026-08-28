import test from "node:test";
import assert from "node:assert/strict";
import {
  useApproveVisualBeats,
  useCreateVisualBeat,
  useStoryboardQuery,
  useUpdateVisualBeatReview,
} from "../src/renderer/features/storyboard/queries/storyboard.queries.ts";

test("storyboard server-state operations are exposed through feature query hooks", () => {
  assert.equal(typeof useStoryboardQuery, "function");
  assert.equal(typeof useCreateVisualBeat, "function");
  assert.equal(typeof useUpdateVisualBeatReview, "function");
  assert.equal(typeof useApproveVisualBeats, "function");
});
