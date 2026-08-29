import test from "node:test";
import assert from "node:assert/strict";
import { transitionBlackOpacity } from "../src/renderer/features/editor/preview-transition.ts";

test("scene fade preview darkens toward the beat boundary and clears after fade-in", () => {
  const beat = { startMs: 0, endMs: 5000 };
  const plan = { transitionInMs: 0, transitionOutMs: 120 };

  assert.equal(transitionBlackOpacity(beat, plan, 4700), 0);
  assert.ok(transitionBlackOpacity(beat, plan, 4950) > 0.5);
  assert.equal(transitionBlackOpacity(beat, plan, 5000), 1);
});

test("incoming fade starts black and returns transparent", () => {
  const beat = { startMs: 5000, endMs: 9000 };
  const plan = { transitionInMs: 120, transitionOutMs: 0 };

  assert.equal(transitionBlackOpacity(beat, plan, 5000), 1);
  assert.ok(transitionBlackOpacity(beat, plan, 5050) > 0.5);
  assert.equal(transitionBlackOpacity(beat, plan, 5200), 0);
});
