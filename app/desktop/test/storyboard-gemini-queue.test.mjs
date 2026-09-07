import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  beginQueueAttempt,
  createGeminiQueue,
  markQueueAttemptStage,
  markQueueBeatCompleted,
  markQueueBeatSkipped,
  reconcileQueue,
  restoreQueueForSession,
  skipQueueBeatIfMediaReady,
  unresolvedAttemptBeatIds,
} from "../src/renderer/features/storyboard/model/gemini-queue.ts";
import {
  geminiQueueStorageKey,
  loadGeminiQueue,
  saveGeminiQueue,
} from "../src/renderer/features/storyboard/store/gemini-queue.persistence.ts";

function batch(beatIds = ["beat-1", "beat-2", "beat-3"]) {
  return {
    batchId: "batch-1",
    chapterId: "chapter-1",
    storyboardRevisionId: "revision-1",
    sourceHash: "a".repeat(64),
    continuityPlanId: "plan-1",
    continuityPlanRevision: 1,
    continuityReportRevision: 1,
    stylePolicyVersion: "storyboard-manhwa-v2",
    providerPolicyVersion: "gemini-web-3.1-pro-cinematic-v1",
    requestFingerprint: "b".repeat(64),
    status: "PREPARED",
    stale: false,
    hasBlockingIssues: false,
    issues: [],
    beats: beatIds.map((visualBeatId, index) => ({
      snapshotId: `snapshot-${index + 1}`,
      visualBeatId,
      sceneId: "scene-1",
      beatRowVersion: 1,
      prompt: `prompt ${index + 1}`,
      negativePrompt: "",
      characterSnapshotJson: "{}",
      references: [],
      continuitySemanticHash: null,
      inputFingerprint: String(index + 1).repeat(64),
    })),
  };
}

function queue(overrides = {}) {
  const created = createGeminiQueue("chapter-1", batch());
  assert.ok(created);
  return { ...created, ...overrides };
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

test("a new Gemini queue is bound to immutable backend snapshots", () => {
  const created = createGeminiQueue("chapter-1", batch(["beat-1", "beat-2"]));
  assert.ok(created);
  assert.equal(created.batchId, "batch-1");
  assert.equal(created.batchFingerprint, "b".repeat(64));
  assert.deepEqual(created.beatIds, ["beat-1", "beat-2"]);
  assert.deepEqual(created.snapshotIdsByBeat, {
    "beat-1": "snapshot-1",
    "beat-2": "snapshot-2",
  });
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

test("queue reconciliation removes deleted beats and their snapshot/attempt metadata", () => {
  const state = beginQueueAttempt(queue({ completedBeatIds: ["beat-1"], currentIndex: 1 }), "beat-2", {
    attemptId: "attempt-2",
    snapshotId: "snapshot-2",
    inputFingerprint: "2".repeat(64),
    stage: "PREPARED",
  });
  const reconciled = reconcileQueue(state, new Set(["beat-1", "beat-3"]));

  assert.ok(reconciled);
  assert.deepEqual(reconciled.beatIds, ["beat-1", "beat-3"]);
  assert.deepEqual(reconciled.completedBeatIds, ["beat-1"]);
  assert.deepEqual(reconciled.snapshotIdsByBeat, {
    "beat-1": "snapshot-1",
    "beat-3": "snapshot-3",
  });
  assert.deepEqual(reconciled.attemptsByBeat, {});
  assert.equal(reconciled.status, "PAUSED");
});

test("queue reconciliation preserves identity when no beat changed", () => {
  const state = queue({ status: "PAUSED" });
  assert.equal(reconcileQueue(state, new Set(state.beatIds)), state);
});

test("beginning an attempt persists SUBMITTING before the external IPC boundary", () => {
  const started = beginQueueAttempt(queue(), "beat-1", {
    attemptId: "attempt-1",
    snapshotId: "snapshot-1",
    inputFingerprint: "1".repeat(64),
    stage: "PREPARED",
  });
  assert.equal(started.attemptsByBeat["beat-1"].stage, "SUBMITTING");
  assert.deepEqual(unresolvedAttemptBeatIds(started), ["beat-1"]);

  const restored = restoreQueueForSession(started);
  assert.equal(restored.attemptsByBeat["beat-1"].stage, "UNKNOWN");
  assert.equal(restored.status, "PAUSED");
});

test("failed attempts may be explicitly replaced but unresolved attempts cannot", () => {
  const started = beginQueueAttempt(queue(), "beat-1", {
    attemptId: "attempt-1",
    snapshotId: "snapshot-1",
    inputFingerprint: "1".repeat(64),
    stage: "PREPARED",
  });
  assert.throws(
    () =>
      beginQueueAttempt(started, "beat-1", {
        attemptId: "attempt-2",
        snapshotId: "snapshot-1",
        inputFingerprint: "1".repeat(64),
        stage: "PREPARED",
      }),
    /unresolved or completed attempt/,
  );

  const failed = markQueueAttemptStage(started, "beat-1", "FAILED");
  const retried = beginQueueAttempt(failed, "beat-1", {
    attemptId: "attempt-2",
    snapshotId: "snapshot-1",
    inputFingerprint: "1".repeat(64),
    stage: "PREPARED",
  });
  assert.equal(retried.attemptsByBeat["beat-1"].attemptId, "attempt-2");
  assert.equal(retried.attemptsByBeat["beat-1"].stage, "SUBMITTING");
});

test("completing and skipping beats advance independently and finish the queue", () => {
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

test("legacy queue migration pauses pending work without deleting completed/skipped history", () => {
  const storage = memoryStorage();
  const key = geminiQueueStorageKey("project-1", "chapter-1");
  storage.setItem(
    key,
    JSON.stringify({
      chapterId: "chapter-1",
      beatIds: ["beat-1", "beat-2", "beat-3"],
      completedBeatIds: ["beat-1"],
      skippedBeatIds: ["beat-2"],
      currentIndex: 2,
      status: "RUNNING",
    }),
  );

  const migrated = loadGeminiQueue("project-1", "chapter-1", storage);
  assert.ok(migrated);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.status, "PAUSED");
  assert.equal(migrated.legacyNeedsPrepare, true);
  assert.deepEqual(migrated.completedBeatIds, ["beat-1"]);
  assert.deepEqual(migrated.skippedBeatIds, ["beat-2"]);
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
});

test("Storyboard Generate Gemini All prepares only beats missing preview media", () => {
  const source = readFileSync(
    "src/renderer/features/storyboard/screens/StoryboardScreen.tsx",
    "utf8",
  );
  assert.match(
    source,
    /beatsPendingGeminiGeneration[\s\S]*allChapterBeats\.filter\(\(beat\) => !beat\.previewMediaAssetId\)/,
  );
  assert.match(source, /prepareGeminiBatch\(beatIds\)/);
  assert.match(source, /skipQueueBeatIfMediaReady\(queue, beat\)/);
});
