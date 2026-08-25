import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RenderJournalStore } from "../src/main/rendering/render-journal.ts";

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
