import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recoveryActionForStage, RenderJournalStore } from "../src/main/rendering/render-journal.ts";

test("render journal writes atomically and lists unfinished jobs", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-journal-"));
  try {
    const store = new RenderJournalStore(root);
    const journal = { version: 1, projectId: "00000000-0000-0000-0000-000000000001", jobId: "job-1", renderFingerprint: "fingerprint", stage: "SEGMENT_RENDER", workDirectory: "work", updatedAt: new Date().toISOString() };
    await import("node:fs/promises").then(({ mkdir }) => mkdir(join(root, journal.projectId, "work", journal.jobId), { recursive: true }));
    await store.save(journal);
    const unfinished = await store.listUnfinished();
    assert.equal(unfinished[0]?.jobId, "job-1");
    assert.equal((await store.advance(journal, "COMPLETED")).stage, "COMPLETED");
    assert.deepEqual(await store.listUnfinished(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("render journal distinguishes known failure, cancellation and interruption", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-journal-terminal-"));
  try {
    const store = new RenderJournalStore(root);
    const journal = { version: 1, projectId: "00000000-0000-0000-0000-000000000002", jobId: "job-2", renderFingerprint: "fingerprint", stage: "VERIFY", workDirectory: "work", updatedAt: new Date().toISOString() };
    await store.save(journal);
    const failed = await store.fail(journal, "RENDER_VERIFY_FAILED", "VERIFY", "signed URL https://example.test/a?token=secret", true);
    assert.equal(failed.stage, "FAILED");
    assert.equal(failed.terminalState, "KNOWN_FAILURE");
    assert.match(failed.errorDetail, /redacted-url/);
    const secretSafe = await store.fail(journal, "RENDER_VERIFY_FAILED", "VERIFY", "token=secret password=hunter2 signature=abc", true);
    assert.doesNotMatch(secretSafe.errorDetail, /secret|hunter2|abc/);
    assert.match(secretSafe.errorDetail, /token=\[redacted\]/);
    assert.deepEqual(await store.listUnfinished(), []);

    const canceled = await store.advance({ ...journal, jobId: "job-3" }, "CANCELLED");
    assert.equal(canceled.terminalState, "USER_CANCELLED");
    assert.equal((await store.listUnfinished()).length, 0);

    const interrupted = { ...journal, jobId: "job-4" };
    await store.save(interrupted);
    assert.equal((await store.listUnfinished()).some((entry) => entry.jobId === "job-4"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restart recovery action is deterministic by last checkpoint", () => {
  assert.equal(recoveryActionForStage("MATERIALIZING"), "RETRY_STAGE");
  assert.equal(recoveryActionForStage("SEGMENT_RENDER"), "RERUN_RENDER");
  assert.equal(recoveryActionForStage("REGISTER"), "RECONCILE_REGISTER");
  assert.equal(recoveryActionForStage("FAILED"), "USER_RETRY");
});
