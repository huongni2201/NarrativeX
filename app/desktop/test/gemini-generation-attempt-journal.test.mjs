import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GeminiGenerationAttemptJournal } from "../src/main/gemini-web/gemini-generation-attempt-journal.ts";

function record(attemptId, overrides = {}) {
  return {
    attemptId,
    lane: "STORYBOARD",
    projectId: "project-1",
    batchId: "batch-1",
    snapshotId: "snapshot-1",
    batchFingerprint: "a".repeat(64),
    inputFingerprint: "b".repeat(64),
    stylePolicyVersion: "storyboard-manhwa-v2",
    providerPolicyVersion: "gemini-web-3.1-pro-cinematic-v1",
    ...overrides,
  };
}

async function withJournal(run) {
  const root = await mkdtemp(join(tmpdir(), "narrativex-gemini-attempt-"));
  try {
    await run(new GeminiGenerationAttemptJournal(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("attempt id is durably bound to one immutable snapshot", async () => {
  await withJournal(async (journal) => {
    const first = await journal.begin(record("attempt-1"));
    assert.equal(first.stage, "PREPARED");

    const same = await journal.begin(record("attempt-1"));
    assert.equal(same.snapshotId, "snapshot-1");
    assert.equal(same.stage, "SUBMITTING");

    await assert.rejects(
      () => journal.begin(record("attempt-1", { snapshotId: "snapshot-2" })),
      /GEMINI_ATTEMPT_ID_CONFLICT/,
    );
  });
});

test("only one concurrent caller claims a Gemini submission", async () => {
  await withJournal(async (journal) => {
    const [first, second] = await Promise.all([
      journal.begin(record("attempt-1")),
      journal.begin(record("attempt-1")),
    ]);
    const stages = [first.stage, second.stage].sort();
    assert.deepEqual(stages, ["PREPARED", "SUBMITTING"]);
    assert.equal((await journal.get("attempt-1"))?.stage, "SUBMITTING");
  });
});

test("journal survives restart and preserves ambiguous SUBMITTING/UNKNOWN stages", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-gemini-attempt-"));
  try {
    const first = new GeminiGenerationAttemptJournal(root);
    await first.begin(record("attempt-1"));
    await first.update("attempt-1", "SUBMITTING");

    const restarted = new GeminiGenerationAttemptJournal(root);
    const submitting = await restarted.get("attempt-1");
    assert.equal(submitting?.stage, "SUBMITTING");

    await restarted.update("attempt-1", "UNKNOWN", { errorCode: "GEMINI_GENERATION_TIMEOUT" });
    const third = new GeminiGenerationAttemptJournal(root);
    const unknown = await third.get("attempt-1");
    assert.equal(unknown?.stage, "UNKNOWN");
    assert.equal(unknown?.errorCode, "GEMINI_GENERATION_TIMEOUT");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("completed output checksum remains available for reconciliation", async () => {
  await withJournal(async (journal) => {
    await journal.begin(record("attempt-1"));
    await journal.update("attempt-1", "COMPLETED", {
      outputChecksumSha256: "c".repeat(64),
      errorCode: null,
    });
    const completed = await journal.get("attempt-1");
    assert.equal(completed?.stage, "COMPLETED");
    assert.equal(completed?.outputChecksumSha256, "c".repeat(64));
  });
});
