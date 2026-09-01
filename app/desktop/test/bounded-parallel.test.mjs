import test from "node:test";
import assert from "node:assert/strict";
import { runBoundedParallel } from "../src/renderer/shared/bounded-parallel.ts";

test("bounded parallel runner never exceeds configured concurrency", async () => {
  let active = 0;
  let maxActive = 0;
  const completed = [];
  await runBoundedParallel([1, 2, 3, 4, 5], 2, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    completed.push(item);
    active -= 1;
  });
  assert.equal(maxActive, 2);
  assert.deepEqual([...completed].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test("bounded parallel runner can stop assigning new work", async () => {
  let continueWork = true;
  const started = [];
  await runBoundedParallel([1, 2, 3, 4, 5], 2, async (item) => {
    started.push(item);
    if (item === 1) continueWork = false;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }, () => continueWork);
  assert.ok(started.length <= 2);
});

test("bounded parallel runner clamps concurrency to useful limits", async () => {
  const started = [];
  await runBoundedParallel([1, 2], 99, async (item) => started.push(item));
  assert.deepEqual(started.sort(), [1, 2]);
});
