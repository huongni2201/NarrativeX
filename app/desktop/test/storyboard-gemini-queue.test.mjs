import test from "node:test";
import assert from "node:assert/strict";
import {
  markQueueBeatCompleted,
  markQueueBeatSkipped,
  reconcileQueue,
  restoreQueueForSession,
} from "../src/renderer/features/storyboard/model/gemini-queue.ts";
import {
  geminiQueueStorageKey,
  loadGeminiQueue,
  saveGeminiQueue,
} from "../src/renderer/features/storyboard/store/gemini-queue.persistence.ts";

function queue(overrides = {}) {
  return {
    chapterId: "chapter-1",
    beatIds: ["beat-1", "beat-2", "beat-3"],
    completedBeatIds: [],
    skippedBeatIds: [],
    currentIndex: 0,
    status: "RUNNING",
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("a running Gemini queue restores paused after a renderer restart", () => {
  assert.equal(restoreQueueForSession(queue()).status, "PAUSED");
});

test("queue reconciliation removes deleted beats and advances to the first pending beat", () => {
  const reconciled = reconcileQueue(
    queue({ completedBeatIds: ["beat-1"], currentIndex: 1 }),
    new Set(["beat-1", "beat-3"]),
  );

  assert.deepEqual(reconciled, {
    chapterId: "chapter-1",
    beatIds: ["beat-1", "beat-3"],
    completedBeatIds: ["beat-1"],
    skippedBeatIds: [],
    currentIndex: 1,
    status: "RUNNING",
  });
});

test("completing and skipping beats advance serially and finish the queue", () => {
  const completed = markQueueBeatCompleted(queue(), "beat-1");
  assert.equal(completed.currentIndex, 1);
  assert.deepEqual(completed.completedBeatIds, ["beat-1"]);

  const skipped = markQueueBeatSkipped(completed, "beat-2");
  assert.equal(skipped.currentIndex, 2);
  assert.deepEqual(skipped.skippedBeatIds, ["beat-2"]);

  const finished = markQueueBeatCompleted(skipped, "beat-3");
  assert.equal(finished.currentIndex, 3);
  assert.equal(finished.status, "COMPLETED");
});

test("queue persistence is scoped by project/chapter and malformed payloads are ignored", () => {
  const storage = memoryStorage();
  const state = queue({ status: "PAUSED" });
  const key = geminiQueueStorageKey("project-1", "chapter-1");

  saveGeminiQueue("project-1", "chapter-1", state, storage);
  assert.deepEqual(loadGeminiQueue("project-1", "chapter-1", storage), state);

  storage.setItem(key, "{bad-json");
  assert.equal(loadGeminiQueue("project-1", "chapter-1", storage), null);

  saveGeminiQueue("project-1", "chapter-1", null, storage);
  assert.equal(storage.getItem(key), null);
});
