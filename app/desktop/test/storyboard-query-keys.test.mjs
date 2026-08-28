import test from "node:test";
import assert from "node:assert/strict";
import { storyboardKeys } from "../src/renderer/features/storyboard/queries/storyboard.queries.ts";

test("storyboard chapter cache key preserves the existing backend-oriented identity", () => {
  assert.deepEqual(storyboardKeys.chapter("project-1", "chapter-1"), [
    "projects",
    "project-1",
    "chapters",
    "chapter-1",
    "storyboard",
  ]);
});
