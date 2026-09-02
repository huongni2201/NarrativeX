import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createGeminiQueue,
  markQueueBeatCompleted,
  markQueueBeatSkipped,
  reconcileQueue,
  restoreQueueForSession,
  skipQueueBeatIfMediaReady,
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

test("a new Gemini All queue includes approved beats that still need media", () => {
  const created = createGeminiQueue("chapter-1", [
    { id: "beat-1", reviewStatus: "NEEDS_REVIEW", previewMediaAssetId: null },
    { id: "beat-2", reviewStatus: "APPROVED", previewMediaAssetId: null },
    { id: "beat-3", reviewStatus: "APPROVED", previewMediaAssetId: "asset-3" },
  ]);

  assert.deepEqual(created, queue({ beatIds: ["beat-1", "beat-2"] }));
  assert.equal(
    createGeminiQueue("chapter-1", [
      { id: "beat-3", reviewStatus: "APPROVED", previewMediaAssetId: "asset-3" },
    ]),
    null,
  );
});

test("a persisted Gemini queue skips a beat that acquired media before resume", () => {
  const state = queue();
  const skipped = skipQueueBeatIfMediaReady(state, {
    id: "beat-1",
    reviewStatus: "APPROVED",
    previewMediaAssetId: "asset-1",
  });

  assert.deepEqual(skipped.skippedBeatIds, ["beat-1"]);
  assert.equal(skipped.currentIndex, 1);
  assert.equal(
    skipQueueBeatIfMediaReady(state, {
      id: "beat-1",
      reviewStatus: "APPROVED",
      previewMediaAssetId: null,
    }),
    state,
  );
});

test("queue reconciliation removes deleted beats, advances, and pauses before continuing", () => {
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
    status: "PAUSED",
  });
});

test("queue reconciliation preserves identity when no beat changed", () => {
  const state = queue({ status: "PAUSED" });
  assert.equal(reconcileQueue(state, new Set(state.beatIds)), state);
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

test("Storyboard queue transitions publish to local storage from the runner", () => {
  const source = readFileSync(
    "src/renderer/features/storyboard/screens/StoryboardScreen.tsx",
    "utf8",
  );
  assert.match(source, /function publishGeminiQueue/);
  assert.match(source, /publishGeminiQueue\(queue\)/);
  assert.match(
    source,
    /generationResult === "GENERATED"[\s\S]*markQueueBeatCompleted[\s\S]*publishGeminiQueue/,
  );
  assert.doesNotMatch(source, /useEffect\(\(\) => \{[\s\S]*saveGeminiQueue\(projectId, selectedChapterId, geminiQueue\)/);
});

test("Storyboard Generate Gemini All targets missing preview media instead of review status", () => {
  const source = readFileSync(
    "src/renderer/features/storyboard/screens/StoryboardScreen.tsx",
    "utf8",
  );
  assert.match(
    source,
    /beatsPendingGeminiGeneration[\s\S]*allChapterBeats\.filter\(\(beat\) => !beat\.previewMediaAssetId\)/,
  );
  assert.match(source, /skipQueueBeatIfMediaReady\(queue, beat\)/);
});
