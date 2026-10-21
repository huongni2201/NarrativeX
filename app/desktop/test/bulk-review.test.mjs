import test from "node:test";
import assert from "node:assert/strict";
import { runReviewBatch } from "../src/renderer/lib/review-batch.ts";
import { bulkTakeCandidates, isTakeSelectable } from "../src/renderer/features/production/model/take-review.ts";
import { DesktopApiError } from "../src/renderer/api/client.ts";

test("batch review bounds requests and reports partial writes without replay", async () => {
  const calls = [];
  const progress = [];
  let active = 0;
  const result = await runReviewBatch([{ id: "a", rowVersion: 2 }, { id: "b", rowVersion: 9 }, { id: "c", rowVersion: 4 }], async (item) => {
    assert.equal(active++, 0);
    calls.push([item.id, item.rowVersion]);
    await Promise.resolve();
    active--;
    if (item.id === "b") throw new DesktopApiError("/review", 409, "version conflict");
  }, (count) => progress.push(count));
  assert.deepEqual(calls, [["a", 2], ["b", 9], ["c", 4]]);
  assert.deepEqual(result, { succeeded: ["a", "c"], failed: [{ id: "b", message: "version conflict" }], unattempted: [], stopReason: null });
  assert.deepEqual(progress, [1, 2, 3]);
});

test("network, protocol, auth and server errors stop unsent writes and preserve successes", async () => {
  for (const error of [new Error("offline"), ...[401, 403, 408, 429, 500, 503].map((status) => new DesktopApiError("/review", status, "unavailable"))]) {
    const calls = [];
    const result = await runReviewBatch([{ id: "a" }, { id: "b" }, { id: "c" }], async (item) => {
      calls.push(item.id);
      if (item.id === "b") throw error;
    });
    assert.deepEqual(calls, ["a", "b"]);
    assert.deepEqual(result.succeeded, ["a"]);
    assert.deepEqual(result.unattempted, ["c"]);
    assert.equal(result.failed[0].id, "b");
    assert.equal(result.stopReason, "unavailable");
  }
});

test("cancellation records the current write then skips unsent writes", async () => {
  const controller = new AbortController();
  let release;
  const calls = [];
  const pending = runReviewBatch([{ id: "a" }, { id: "b" }], (item) => {
    calls.push(item.id);
    return new Promise((resolve) => { release = resolve; });
  }, undefined, controller.signal);
  controller.abort();
  release();
  const result = await pending;
  assert.deepEqual(calls, ["a"]);
  assert.deepEqual(result, { succeeded: ["a"], failed: [], unattempted: ["b"], stopReason: "cancelled" });
  const notStarted = await runReviewBatch([{ id: "c" }], () => { throw new Error("must not run"); }, undefined, controller.signal);
  assert.deepEqual(notStarted.unattempted, ["c"]);
  assert.deepEqual(notStarted.failed, []);
});

const take = (id, attemptNumber, patch = {}) => ({ id, attemptNumber, status: "PASSED", validationResult: { passed: true }, outputAssetId: "asset", sourceDurationMs: 4000, ...patch });

test("bulk candidates preserve selected Takes and offer only terminal validated footage", () => {
  const old = take("old", 1);
  const latest = take("latest", 2);
  const shots = [
    { id: "selected", selectedTake: { takeId: "chosen" }, takes: [latest] },
    { id: "empty", takes: [] },
    { id: "available", takes: [old, take("running", 3, { status: "RUNNING" }), latest] },
  ];
  const candidates = bulkTakeCandidates(shots);
  assert.deepEqual(candidates.map((item) => item.shot.id), ["available"]);
  assert.deepEqual(candidates[0].takes.map((item) => item.id), ["latest", "old"]);
  assert.equal(shots[2].takes[0].id, "old");
  for (const invalid of [{ validationResult: { passed: false } }, { outputAssetId: null }, { sourceDurationMs: 0 }, { sourceDurationMs: Infinity }, { status: "UNKNOWN" }, { status: "FAILED" }]) {
    assert.equal(isTakeSelectable(take("bad", 1, invalid)), false);
  }
});
