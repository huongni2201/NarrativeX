import test from "node:test";
import assert from "node:assert/strict";
import { isEditorMutationCurrent } from "../src/renderer/features/editor/editor-mutation-state.ts";

test("editor mutation remains current only for the same request and beat", () => {
  assert.equal(
    isEditorMutationCurrent(
      { requestId: 7, beatId: "beat-a" },
      { requestId: 7, beatId: "beat-a" },
    ),
    true,
  );
});

test("editor mutation becomes stale when selection moves to another beat", () => {
  assert.equal(
    isEditorMutationCurrent(
      { requestId: 8, beatId: "beat-b" },
      { requestId: 8, beatId: "beat-a" },
    ),
    false,
  );
});

test("editor mutation becomes stale when a newer mutation supersedes it", () => {
  assert.equal(
    isEditorMutationCurrent(
      { requestId: 9, beatId: "beat-a" },
      { requestId: 8, beatId: "beat-a" },
    ),
    false,
  );
});
