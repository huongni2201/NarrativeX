import assert from "node:assert/strict";
import test from "node:test";
import {
  beatsNeedingReview,
  filterVisualBeatsByStatus,
} from "../src/renderer/features/storyboard/storyboard-review.ts";

const beats = [
  { id: "beat-1", reviewStatus: "NEEDS_REVIEW" },
  { id: "beat-2", reviewStatus: "APPROVED" },
  { id: "beat-3", reviewStatus: "NEEDS_REVIEW" },
];

test("filters storyboard visual beats by their review status", () => {
  assert.deepEqual(
    filterVisualBeatsByStatus(beats, "NEEDS_REVIEW").map((beat) => beat.id),
    ["beat-1", "beat-3"],
  );
  assert.deepEqual(
    filterVisualBeatsByStatus(beats, "APPROVED").map((beat) => beat.id),
    ["beat-2"],
  );
  assert.deepEqual(
    filterVisualBeatsByStatus(beats, "ALL").map((beat) => beat.id),
    ["beat-1", "beat-2", "beat-3"],
  );
});

test("approve-all scope contains only beats that still need review", () => {
  assert.deepEqual(
    beatsNeedingReview(beats).map((beat) => beat.id),
    ["beat-1", "beat-3"],
  );
});
