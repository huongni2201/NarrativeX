import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeLocalRun, formatElapsed } from "../src/renderer/features/jobs/model/analysis-run.ts";
import { StoryAnalysisService } from "../src/main/story-analysis/service.ts";

const job = { jobId: "job-1", jobType: "CHAPTER_ANALYZE", status: "RUNNING" };
const started = "2026-10-16T00:55:16.000Z";
const at = seconds => Date.parse(started) + seconds * 1000;

test("elapsed time is spelled out in Vietnamese", () => {
  assert.equal(formatElapsed(45_000), "45 giây");
  assert.equal(formatElapsed(272_000), "4 phút 32 giây");
  assert.equal(formatElapsed(3_900_000), "1 giờ 5 phút");
  assert.equal(formatElapsed(-5), "0 giây");
});

test("a running analysis with a live agy process says so, with PID and elapsed time", () => {
  const indicator = describeLocalRun(job, [{ jobId: "job-1", startedAt: started, pid: 28224, processAlive: true }], at(272));
  assert.deepEqual(indicator, { tone: "success", text: "agy đang chạy · PID 28224 · 4 phút 32 giây" });
});

test("a missing or dead process is called out instead of looking healthy", () => {
  assert.equal(describeLocalRun(job, [], at(10))?.tone, "warning");
  assert.equal(describeLocalRun(job, [{ jobId: "job-1", startedAt: started, pid: 5, processAlive: false }], at(10))?.tone, "danger");
  assert.equal(describeLocalRun(job, [{ jobId: "job-1", startedAt: started, pid: null, processAlive: true }], at(1))?.text, "Đang khởi động agy…");
});

test("nothing is claimed for other jobs or when the Desktop cannot answer", () => {
  assert.equal(describeLocalRun(job, undefined, at(1)), null, "no bridge or not loaded yet");
  assert.equal(describeLocalRun({ ...job, status: "COMPLETED" }, [], at(1)), null);
  assert.equal(describeLocalRun({ ...job, jobType: "NARRATION" }, [], at(1)), null);
});

test("the service reports the running chapter with its agy pid and forgets it when the run ends", async () => {
  const root = await mkdtemp(join(tmpdir(), "nx-activity-"));
  let finish;
  let seen = null;
  const service = new StoryAnalysisService(join(root, "journal"), {
    session: {
      eligibility: async () => ({ credentialRef: "11111111-1111-4111-8111-111111111111", maxParallel: 1 }),
      noteSuccess() {}, noteFailure: async () => {}, noteDeliveryProblem() {}, setRunning() {},
    },
    request: async path => path.endsWith("/claim")
      ? { jobId: "job-1", projectId: "p", attemptId: "a1", leaseToken: "l1", sourceUnits: [{ index: 0, text: "t" }], sourceLanguage: "vi", promptTemplate: "t", responseSchema: {}, profile: {}, maxInputBytes: 1e6, maxOutputBytes: 1e6, maxRuntimeMs: 1000 }
      : path.endsWith("/cancellation") ? false : null,
    run: (claim, signal, hooks) => new Promise(resolve => {
      hooks.onSpawn(4242);
      seen = service.currentActivity();
      finish = () => resolve({ leaseToken: claim.leaseToken, rawJson: "{}", adapterVersion: "antigravity-cli/3", conversationId: null,
        usage: { promptTokens: 1, outputTokens: 1, thinkingTokens: 0, cachedTokens: 0, totalTokens: 2, runtimeMs: 1 } });
    }),
    encrypt: v => Buffer.from(v), decrypt: b => b.toString(),
  });
  try {
    await service.tick();
    for (let i = 0; i < 50 && !seen; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(seen.length, 1);
    assert.equal(seen[0].jobId, "job-1");
    assert.equal(seen[0].pid, 4242);
    assert.ok(!Number.isNaN(Date.parse(seen[0].startedAt)));
    finish();
    await service.idle();
    assert.deepEqual(service.currentActivity(), []);
  } finally { service.stop(); await rm(root, { recursive: true, force: true }); }
});
