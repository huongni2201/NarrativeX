import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryAnalysisService } from "../src/main/story-analysis/service.ts";
import { AnalysisBackendError, AnalysisError } from "../src/main/story-analysis/types.ts";

const REF = "11111111-1111-4111-8111-111111111111";
const encrypt = value => Buffer.from(`enc:${value}`, "utf8");
const decrypt = value => value.toString("utf8").replace(/^enc:/u, "");
const completion = (attemptId, lease = `lease-${attemptId}`) => ({
  leaseToken: lease, rawJson: "{\"scenes\":[]}", adapterVersion: "antigravity-cli/2", conversationId: "c",
  usage: { promptTokens: 1, outputTokens: 1, thinkingTokens: 0, cachedTokens: 0, totalTokens: 2, runtimeMs: 5 },
});

async function build({ jobs = 1, maxParallel = 1, eligible = true, run, requestHook, decryptWith = decrypt, onDeliveryError } = {}) {
  const root = await mkdtemp(join(tmpdir(), "nx-analysis-service-"));
  const directory = join(root, "journal");
  const queue = Array.from({ length: jobs }, (_, index) => ({
    jobId: `job-${index + 1}`, projectId: "p", attemptId: `attempt-${index + 1}`, leaseToken: `lease-attempt-${index + 1}`,
    sourceUnits: [{ index: 0, text: "secret chapter text" }], sourceLanguage: "vi", promptTemplate: "t", responseSchema: {},
    profile: { model: "m", effort: "HIGH", promptHash: "a", schemaHash: "b" },
    maxInputBytes: 1e6, maxOutputBytes: 1e6, maxRuntimeMs: 1000,
  }));
  const requests = [];
  const notes = { success: 0, failures: [], delivery: [], running: [] };
  const runs = [];
  const service = new StoryAnalysisService(directory, {
    session: {
      eligibility: async () => eligible ? { credentialRef: REF, maxParallel } : null,
      noteSuccess: () => { notes.success++; },
      noteFailure: async error => { notes.failures.push(error.code); },
      noteDeliveryProblem: code => { notes.delivery.push(code); },
      setRunning: count => { notes.running.push(count); },
    },
    request: async (path, body) => {
      requests.push({ path, body });
      if (requestHook) { const outcome = await requestHook(path, body); if (outcome !== undefined) return outcome; }
      if (path.endsWith("/claim")) return queue.shift() ?? null;
      if (path.endsWith("/cancellation")) return false;
      return null;
    },
    run: run ?? (async claim => { runs.push(claim.attemptId); return completion(claim.attemptId); }),
    encrypt, decrypt: decryptWith, onDeliveryError,
  });
  return { service, directory, requests, notes, runs, queue, cleanup: () => { service.stop(); return rm(root, { recursive: true, force: true }); } };
}
const posts = (h, suffix) => h.requests.filter(r => r.path.endsWith(suffix));
const journals = async h => (await readdir(h.directory).catch(() => [])).filter(name => name.startsWith("pending-"));

test("one chapter: claim, run, complete, and the journal is gone", async () => {
  const h = await build();
  try {
    await h.service.tick();
    await h.service.idle();
    const claim = posts(h, "/claim")[0].body;
    assert.equal(claim.credentialRef, REF);
    assert.equal(claim.adapterVersion, "antigravity-cli/2");
    assert.match(claim.claimRequestId, /^[0-9a-f-]{36}$/u);
    assert.deepEqual(h.runs, ["attempt-1"]);
    const complete = posts(h, "/attempt-1/complete");
    assert.equal(complete.length, 1);
    assert.equal(complete[0].body.leaseToken, "lease-attempt-1");
    assert.equal(complete[0].body.adapterVersion, "antigravity-cli/2");
    assert.deepEqual(await journals(h), []);
    assert.equal(h.notes.success, 1);
  } finally { await h.cleanup(); }
});

test("the encrypted journal never keeps the chapter text", async () => {
  let snapshot = "";
  const h = await build({ run: async claim => {
    for (const name of await readdir(join(h.directory)).catch(() => [])) if (name.startsWith("pending-")) snapshot += await (await import("node:fs/promises")).readFile(join(h.directory, name), "utf8");
    return completion(claim.attemptId);
  } });
  try {
    await h.service.tick();
    await h.service.idle();
    assert.match(snapshot, /attempt-1/u);
    assert.doesNotMatch(snapshot, /secret chapter text/u);
  } finally { await h.cleanup(); }
});

test("claims up to maxParallel chapters at once and no more", async () => {
  const release = [];
  let active = 0, peak = 0;
  const h = await build({ jobs: 5, maxParallel: 2, run: claim => new Promise(resolve => {
    active++; peak = Math.max(peak, active);
    release.push(() => { active--; resolve(completion(claim.attemptId)); });
  }) });
  try {
    await h.service.tick();
    assert.equal(posts(h, "/claim").length, 2, "exactly two claims while two slots are free");
    assert.equal(active, 2);
    await h.service.tick();
    assert.equal(posts(h, "/claim").length, 2, "a full house claims nothing more");
    release.shift()();
    await new Promise(resolve => setTimeout(resolve, 20));
    await h.service.tick();
    assert.equal(posts(h, "/claim").length, 3, "a freed slot is refilled");
    while (release.length) { release.shift()(); await new Promise(resolve => setTimeout(resolve, 5)); }
    await h.service.idle();
    assert.equal(peak, 2);
    assert.equal(posts(h, "/complete").length, 3);
  } finally { await h.cleanup(); }
});

test("nothing is claimed while the session is not eligible, and an empty queue leaves no journal", async () => {
  const blocked = await build({ eligible: false });
  try { await blocked.service.tick(); assert.equal(blocked.requests.length, 0); }
  finally { await blocked.cleanup(); }
  const empty = await build({ jobs: 0, maxParallel: 3 });
  try {
    await empty.service.tick();
    assert.equal(posts(empty, "/claim").length, 1, "stops asking after the first empty answer");
    assert.deepEqual(await journals(empty), []);
  } finally { await empty.cleanup(); }
});

test("a known failure is observed as not ambiguous; an unresolved one as ambiguous", async () => {
  for (const [error, expected] of [
    [new AnalysisError("QUOTA_EXHAUSTED", false), { code: "QUOTA_EXHAUSTED", ambiguous: false }],
    [new AnalysisError("AMBIGUOUS_OUTCOME", true), { code: "AMBIGUOUS_OUTCOME", ambiguous: true }],
    [new Error("boom"), { code: "AMBIGUOUS_OUTCOME", ambiguous: true }],
  ]) {
    const h = await build({ run: async () => { throw error; } });
    try {
      await h.service.tick();
      await h.service.idle();
      const observation = posts(h, "/attempt-1/observation")[0];
      assert.deepEqual({ code: observation.body.code, ambiguous: observation.body.ambiguous }, expected);
      assert.equal(posts(h, "/complete").length, 0);
      assert.deepEqual(h.runs, [], "no second inference");
      assert.deepEqual(h.notes.failures, [expected.code]);
      assert.deepEqual(await journals(h), []);
    } finally { await h.cleanup(); }
  }
});

test("a failed delivery keeps the result and delivers it later without running again", async () => {
  let failures = 1;
  const h = await build({ requestHook: path => { if (path.endsWith("/complete") && failures-- > 0) throw new AnalysisBackendError(503); } });
  try {
    await h.service.tick();
    await h.service.idle();
    assert.equal((await journals(h)).length, 1);
    assert.ok(h.notes.delivery.includes("RESULT_DELIVERY_PENDING"));
    await h.service.tick();
    await h.service.idle();
    assert.equal(posts(h, "/attempt-1/complete").length, 2);
    assert.deepEqual(h.runs, ["attempt-1"], "inference ran exactly once");
    assert.deepEqual(await journals(h), []);
  } finally { await h.cleanup(); }
});

test("after a restart a stored result is delivered and an interrupted claim is recovered", async () => {
  const h = await build({ jobs: 0 });
  try {
    await mkdir(h.directory, { recursive: true });
    const done = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", interrupted = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", claimedOnly = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const write = (id, journal) => writeFile(join(h.directory, `pending-${id}.encrypted`), encrypt(JSON.stringify({ claimRequestId: id, credentialRef: REF, ...journal })));
    await write(done, { claim: { jobId: "j", attemptId: "attempt-9", leaseToken: "l9" }, completion: completion("attempt-9", "l9") });
    await write(interrupted, {});
    await write(claimedOnly, { claim: { jobId: "j", attemptId: "attempt-8", leaseToken: "l8" } });
    await h.service.tick();
    assert.equal(posts(h, "/attempt-9/complete").length, 1);
    assert.deepEqual(posts(h, "/recover").map(r => r.body.claimRequestId).sort(), [interrupted, claimedOnly].sort());
    assert.deepEqual(await journals(h), []);
    assert.deepEqual(h.runs, [], "recovery never re-runs inference");
  } finally { await h.cleanup(); }
});

test("a result the backend rejects is kept encrypted, reported as invalid and not regenerated", async () => {
  const h = await build({ requestHook: path => { if (path.endsWith("/complete")) throw new AnalysisBackendError(422); } });
  try {
    await h.service.tick();
    await h.service.idle();
    const observation = posts(h, "/attempt-1/observation")[0];
    assert.deepEqual({ code: observation.body.code, ambiguous: observation.body.ambiguous }, { code: "SCHEMA_INVALID", ambiguous: false });
    assert.ok((await readdir(h.directory)).includes("attempt-1.rejected.encrypted"));
    assert.deepEqual(await journals(h), []);
    assert.deepEqual(h.runs, ["attempt-1"]);
  } finally { await h.cleanup(); }
});

test("a lost claim answer is reconciled with recover instead of claiming blind", async () => {
  let fail = true;
  const h = await build({ requestHook: path => { if (path.endsWith("/claim") && fail) { fail = false; throw new Error("network down"); } } });
  try {
    await h.service.tick();
    assert.equal((await journals(h)).length, 1, "intent journal kept");
    const lost = posts(h, "/claim")[0].body.claimRequestId;
    await h.service.tick();
    await h.service.idle();
    assert.equal(posts(h, "/recover")[0].body.claimRequestId, lost);
    assert.equal(posts(h, "/complete").length, 1, "the next claim proceeds normally");
  } finally { await h.cleanup(); }
});

test("an unreadable journal is set aside instead of blocking the queue", async () => {
  const h = await build({ jobs: 1, decryptWith: value => { const text = decrypt(value); if (text === "garbage") throw new Error("cannot decrypt"); return text; } });
  try {
    await mkdir(h.directory, { recursive: true });
    const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await writeFile(join(h.directory, `pending-${id}.encrypted`), encrypt("garbage"));
    await h.service.tick();
    await h.service.idle();
    const names = await readdir(h.directory);
    assert.ok(names.includes(`pending-${id}.encrypted.corrupt`));
    assert.equal(posts(h, "/complete").length, 1, "the healthy chapter still runs");
  } finally { await h.cleanup(); }
});

const storedJournal = (h, id, journal) => writeFile(join(h.directory, `pending-${id}.encrypted`), encrypt(JSON.stringify({ claimRequestId: id, credentialRef: REF, ...journal })));

test("a stored result whose attempt the backend no longer knows (404) is set aside and does not block new claims", async () => {
  const h = await build({ jobs: 1, requestHook: path => { if (path.endsWith("/attempt-9/complete")) throw new AnalysisBackendError(404); } });
  try {
    await mkdir(h.directory, { recursive: true });
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await storedJournal(h, id, { claim: { jobId: "j", attemptId: "attempt-9", leaseToken: "l9" }, completion: completion("attempt-9", "l9") });
    await h.service.tick();
    await h.service.idle();
    const names = await readdir(h.directory);
    assert.ok(names.includes("attempt-9.rejected.encrypted"), "the result is kept for inspection");
    assert.ok(!names.includes(`pending-${id}.encrypted`), "the stuck journal is gone");
    assert.deepEqual(h.runs, ["attempt-1"], "the queued chapter was claimed and run in the same tick");
    assert.equal(posts(h, "/attempt-1/complete").length, 1);
    assert.ok(h.notes.delivery.includes("AMBIGUOUS_OUTCOME"));
  } finally { await h.cleanup(); }
});

test("a rejected result whose attempt then turns out to be gone (409 then 404) is not retried forever", async () => {
  const h = await build({ jobs: 0, requestHook: path => {
    if (path.endsWith("/complete")) throw new AnalysisBackendError(409);
    if (path.endsWith("/cancellation")) throw new AnalysisBackendError(410);
  } });
  try {
    await mkdir(h.directory, { recursive: true });
    const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    await storedJournal(h, id, { claim: { jobId: "j", attemptId: "attempt-7", leaseToken: "l7" }, completion: completion("attempt-7", "l7") });
    await h.service.tick();
    const names = await readdir(h.directory);
    assert.ok(names.includes("attempt-7.rejected.encrypted"));
    assert.deepEqual(await journals(h), []);
    assert.equal(posts(h, "/attempt-7/observation")[0].body.code, "SCHEMA_INVALID");
  } finally { await h.cleanup(); }
});

test("a delivery that keeps failing is reported once with its HTTP status, not on every tick", async () => {
  const reports = [];
  const h = await build({ requestHook: path => { if (path.endsWith("/complete")) throw new AnalysisBackendError(401); }, onDeliveryError: (path, status) => reports.push({ path, status }) });
  try {
    await h.service.tick();
    await h.service.idle();
    await h.service.tick();
    await h.service.tick();
    assert.equal((await journals(h)).length, 1, "a 401 keeps the result: it may still be delivered after re-pairing");
    assert.deepEqual(reports, [{ path: "/api/v1/local-devices/chapter-analyses/attempt-1/complete", status: 401 }]);
  } finally { await h.cleanup(); }
});

test("a result that makes the backend answer 5xx every time is rejected instead of blocking the queue forever", async () => {
  const h = await build({ jobs: 2, requestHook: path => { if (path.endsWith("/attempt-1/complete")) throw new AnalysisBackendError(500); } });
  try {
    await h.service.tick();
    await h.service.idle();
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal(posts(h, "/claim").length, 1, "no new chapter is claimed while the result is still being retried");
      await h.service.tick();
    }
    assert.equal(posts(h, "/attempt-1/complete").length, 4);
    await h.service.tick();
    const observation = posts(h, "/attempt-1/observation")[0];
    assert.deepEqual({ code: observation.body.code, ambiguous: observation.body.ambiguous }, { code: "SCHEMA_INVALID", ambiguous: false });
    assert.ok((await readdir(h.directory)).includes("attempt-1.rejected.encrypted"), "the result stays inspectable");
    assert.equal(posts(h, "/cancellation").length, 0, "a server fault is not checked against a user cancel");
    await h.service.idle();
    assert.deepEqual(h.runs, ["attempt-1", "attempt-2"], "attempt-1 was not re-run; the next chapter ran");
    assert.equal(posts(h, "/claim").length, 2, "the next chapter is claimed once the poisoned result is set aside");
  } finally { await h.cleanup(); }
});

test("the runner can ask the backend to check a result with this attempt's lease and unit window", async () => {
  let answers;
  const h = await build({
    requestHook: (path, body) => { if (path.endsWith("/validation")) return [{ severity: "ERROR", path: "scenes[0]", message: body.rawJson }]; },
    run: async (claim, signal, hooks) => { answers = await hooks.validate("{\"scenes\":[]}", 2, 5); return completion(claim.attemptId); },
  });
  try {
    await h.service.tick();
    await h.service.idle();
    const check = posts(h, "/attempt-1/validation");
    assert.equal(check.length, 1);
    assert.deepEqual(check[0].body, { leaseToken: "lease-attempt-1", rawJson: "{\"scenes\":[]}", windowFirst: 2, windowLast: 5 });
    assert.deepEqual(answers, [{ severity: "ERROR", path: "scenes[0]", message: "{\"scenes\":[]}" }]);
    assert.equal(posts(h, "/attempt-1/complete").length, 1);
  } finally { await h.cleanup(); }
});

test("progress is posted with this attempt's lease, and a backend that refuses it never disturbs the run", async () => {
  const h = await build({
    requestHook: (path) => { if (path.endsWith("/progress")) throw new AnalysisBackendError(404); },
    run: async (claim, signal, hooks) => { hooks.onProgress(40); hooks.onProgress(70); return completion(claim.attemptId); },
  });
  try {
    await h.service.tick();
    await h.service.idle();
    assert.deepEqual(posts(h, "/attempt-1/progress").map(entry => entry.body), [
      { leaseToken: "lease-attempt-1", progress: 40 },
      { leaseToken: "lease-attempt-1", progress: 70 },
    ]);
    assert.equal(posts(h, "/attempt-1/complete").length, 1, "the result is still delivered");
    assert.equal(h.notes.success, 1);
  } finally { await h.cleanup(); }
});
