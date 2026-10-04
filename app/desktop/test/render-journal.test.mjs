import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recoveryActionForJournal,
  recoveryActionForStage,
  RenderJournalStore,
} from "../src/main/rendering/render-journal.ts";

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

test("render journal keeps retryable failure resumable but terminal failures closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-journal-terminal-"));
  try {
    const store = new RenderJournalStore(root);
    const journal = { version: 1, projectId: "00000000-0000-0000-0000-000000000002", jobId: "job-2", renderFingerprint: "fingerprint", stage: "VERIFY", workDirectory: "work", updatedAt: new Date().toISOString() };
    await store.save(journal);
    const failed = await store.fail(journal, "RENDER_VERIFY_FAILED", "VERIFY", "signed URL https://example.test/a?token=secret", true);
    assert.equal(failed.stage, "VERIFY");
    assert.equal(failed.terminalState, undefined);
    assert.equal(failed.retryable, true);
    assert.match(failed.errorDetail, /redacted-url/);
    assert.equal((await store.listUnfinished()).some((entry) => entry.jobId === "job-2"), true);

    const terminal = await store.fail({ ...journal, jobId: "job-3" }, "RENDER_CHECKPOINT_MISMATCH", "VERIFY", "snapshot mismatch", false);
    assert.equal(terminal.stage, "FAILED");
    assert.equal(terminal.terminalState, "KNOWN_FAILURE");

    const canceled = await store.advance({ ...journal, jobId: "job-4" }, "CANCELLED");
    assert.equal(canceled.terminalState, "USER_CANCELLED");

    const interrupted = { ...journal, jobId: "job-5" };
    await store.save(interrupted);
    assert.equal((await store.listUnfinished()).some((entry) => entry.jobId === "job-5"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("render journal redacts retryable failure secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-journal-redaction-"));
  try {
    const store = new RenderJournalStore(root);
    const journal = { version: 1, projectId: "00000000-0000-0000-0000-000000000006", jobId: "job-6", renderFingerprint: "fingerprint", stage: "VERIFY", workDirectory: "work", updatedAt: new Date().toISOString() };
    const secretSafe = await store.fail(journal, "RENDER_VERIFY_FAILED", "VERIFY", "token=secret password=hunter2 signature=abc", true);
    assert.doesNotMatch(secretSafe.errorDetail, /secret|hunter2|abc/);
    assert.match(secretSafe.errorDetail, /token=\[redacted\]/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restart recovery action is deterministic by last checkpoint", () => {
  assert.equal(recoveryActionForStage("CLAIMED"), "RETRY_STAGE");
  assert.equal(recoveryActionForStage("MATERIALIZING"), "RETRY_STAGE");
  assert.equal(recoveryActionForStage("VERIFY"), "RETRY_STAGE");
  assert.equal(recoveryActionForStage("SEGMENT_RENDER"), "RERUN_RENDER");
  assert.equal(recoveryActionForStage("VIDEO_CONCAT"), "RERUN_RENDER");
  assert.equal(recoveryActionForStage("AUDIO_CONCAT"), "RERUN_RENDER");
  assert.equal(recoveryActionForStage("MUX"), "RERUN_RENDER");
  assert.equal(recoveryActionForStage("REGISTER"), "RECONCILE_REGISTER");
  assert.equal(recoveryActionForStage("FAILED"), "USER_RETRY");
});

test("render journal discard sets CANCELLED and USER_CANCELLED", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-journal-discard-"));
  try {
    const store = new RenderJournalStore(root);
    const journal = { version: 1, projectId: "00000000-0000-0000-0000-000000000009", jobId: "job-9", renderFingerprint: "fingerprint", stage: "SEGMENT_RENDER", workDirectory: "work", updatedAt: new Date().toISOString() };
    await import("node:fs/promises").then(({ mkdir }) => mkdir(join(root, journal.projectId, "work", journal.jobId), { recursive: true }));
    await store.save(journal);
    assert.equal((await store.listUnfinished()).length, 1);

    const discarded = await store.discard(journal.projectId, journal.jobId);
    assert.equal(discarded, true);
    assert.deepEqual(await store.listUnfinished(), []);

    const loaded = await store.load(journal.projectId, journal.jobId);
    assert.equal(loaded?.stage, "CANCELLED");
    assert.equal(loaded?.terminalState, "USER_CANCELLED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("incompatible recovery stays visible as USER_RETRY with an explicit reason", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-journal-user-retry-"));
  try {
    const store = new RenderJournalStore(root);
    const journal = {
      version: 1,
      projectId: "00000000-0000-0000-0000-000000000010",
      jobId: "job-10",
      renderFingerprint: "fingerprint",
      stage: "REGISTER",
      workDirectory: "work",
      updatedAt: new Date().toISOString(),
    };
    await store.save(journal);

    const recovery = await store.requireUserRetry(journal, "FFmpeg version changed.");

    assert.equal(recoveryActionForJournal(recovery), "USER_RETRY");
    assert.equal(recovery.recoverabilityReason, "FFmpeg version changed.");
    assert.equal((await store.listUnfinished()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discarding one interrupted job leaves another independently recoverable", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-journal-multiple-"));
  try {
    const store = new RenderJournalStore(root);
    const makeJournal = (projectId, jobId, stage) => ({
      version: 1,
      projectId,
      jobId,
      renderFingerprint: "a".repeat(64),
      stage,
      workDirectory: "work",
      updatedAt: new Date().toISOString(),
    });
    await store.save(makeJournal("00000000-0000-0000-0000-000000000011", "job-11", "MATERIALIZING"));
    await store.save(makeJournal("00000000-0000-0000-0000-000000000012", "job-12", "REGISTER"));

    assert.equal(await store.discard("00000000-0000-0000-0000-000000000011", "job-11"), true);
    const unfinished = await store.listUnfinished();
    assert.deepEqual(unfinished.map((journal) => journal.jobId), ["job-12"]);
    assert.equal(recoveryActionForJournal(unfinished[0]), "RECONCILE_REGISTER");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
