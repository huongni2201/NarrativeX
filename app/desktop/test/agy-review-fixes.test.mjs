import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodeExec } from "../src/main/story-analysis/agy-exec.ts";
import { AgyRunner } from "../src/main/story-analysis/agy-runner.ts";
import { AgySession } from "../src/main/story-analysis/agy-session.ts";
import { parseUsage } from "../src/main/story-analysis/agy-usage.ts";
import { DiagnosticsLog, redact } from "../src/main/story-analysis/diagnostics.ts";
import { StoryAnalysisService } from "../src/main/story-analysis/service.ts";
import { MIN_AGY_VERSION, compareVersions } from "../src/main/story-analysis/agy-locator.ts";
import { AnalysisBackendError, AnalysisError } from "../src/main/story-analysis/types.ts";

const REF = "11111111-1111-4111-8111-111111111111";
const claim = (overrides = {}) => ({
  jobId: "job-1", projectId: "p", attemptId: "attempt-1", leaseToken: "lease",
  sourceUnits: [{ index: 0, text: "x" }], sourceLanguage: "vi", promptTemplate: "t", responseSchema: {},
  profile: { model: "gemini-3.8-flash-high", effort: "HIGH", promptHash: "a", schemaHash: "b" },
  maxInputBytes: 200_000, maxOutputBytes: 200_000, maxRuntimeMs: 600_000, ...overrides,
});
const done = (stdout, extra = {}) => ({ exitCode: 0, stdout, stderr: "", timedOut: false, aborted: false, spawnError: null, ...extra });

async function runner(respond, env) {
  const directory = await mkdtemp(join(tmpdir(), "nx-review-runner-"));
  const diagnostics = [];
  const calls = [];
  const instance = new AgyRunner({
    exec: async (file, args, opts) => { calls.push(opts); return respond(); },
    install: async () => ({ path: "agy.exe", version: "1.3.5" }), directory, isolationVerified: true,
    env: env ?? { PATH: "p" }, onDiagnostic: (code, exitCode, reason, raw) => diagnostics.push({ code, reason, raw }),
  });
  return { instance, diagnostics, calls, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

// ---- #1 / #2: the chapter text must never decide the classification nor reach diagnostics ------------------------

test("words from the story in the model output do not trigger quota, refusal or rate-limit classification", async () => {
  const story = "She was exhausted. 'You need permission', he said, on chapter 429; quota of bread, a safety pin.";
  const stdout = JSON.stringify({ event: "result", result: { status: "ERROR", response: story, structured_output: { note: story } } });
  const h = await runner(() => done(stdout, { exitCode: 1 }));
  try {
    await assert.rejects(h.instance.run(claim(), new AbortController().signal), error => {
      assert.equal(error.code, "PROCESS_FAILED");
      assert.equal(error.diagnostic.reason, "UNRECOGNIZED_FAILURE");
      return true;
    });
    assert.doesNotMatch(h.diagnostics[0].raw, /exhausted|permission|bread/u, "model output is not written to diagnostics");
  } finally { await h.cleanup(); }
});

test("a real error carried by the envelope or stderr is still classified", async () => {
  const stdout = JSON.stringify({ event: "result", result: { status: "ERROR", error: "RESOURCE_EXHAUSTED: quota exceeded" } });
  const h = await runner(() => done(stdout, { exitCode: 1 }));
  try { await assert.rejects(h.instance.run(claim(), new AbortController().signal), error => error.code === "QUOTA_EXHAUSTED"); }
  finally { await h.cleanup(); }
});

test("diagnostics keep the end of the text, where CLI errors are printed", () => {
  const text = `${"a ".repeat(3000)}FINAL ERROR LINE`;
  assert.match(redact(text), /FINAL ERROR LINE$/u);
  assert.ok(redact(text).length <= 2048);
});

test("diagnostics log keeps the newest 20 entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nx-review-diag-"));
  try {
    const log = new DiagnosticsLog(join(dir, "d.log"));
    for (let i = 0; i < 25; i++) await log.record("C", 1, `R${i}`, "x");
    const entries = await log.read();
    assert.equal(entries.length, 20);
    assert.equal(entries.at(-1).reason, "R24");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// ---- #3: isolation was only verified on 1.3.5 -------------------------------------------------------------------

test("agy older than the version the isolation spike passed on is not accepted", () => {
  assert.equal(MIN_AGY_VERSION, "1.3.5");
  assert.ok(compareVersions("1.3.4", MIN_AGY_VERSION) < 0);
  assert.ok(compareVersions("1.3.5", MIN_AGY_VERSION) >= 0);
});

// ---- environment, truncation, weekly window ---------------------------------------------------------------------

test("NarrativeX settings and secrets are not passed to agy; the profile is still isolated", async () => {
  const h = await runner(() => done(JSON.stringify({ status: "SUCCESS", structured_output: { a: 1 } })),
    { PATH: "p", NARRATIVEX_BACKEND_URL: "u", DB_PASSWORD: "x", client_secret: "y", HTTPS_PROXY: "keep", USERPROFILE: "real" });
  try {
    await h.instance.run(claim(), new AbortController().signal);
    const env = h.calls[0].env;
    assert.deepEqual(Object.keys(env).sort(), ["HOME", "HTTPS_PROXY", "PATH", "USERPROFILE"]);
    assert.notEqual(env.USERPROFILE, "real");
  } finally { await h.cleanup(); }
});

test("output cut off by the capture limit is reported as such, not as a schema failure", async () => {
  const h = await runner(() => done("{\"status\":\"SUCCESS\"", { truncated: true }));
  try { await assert.rejects(h.instance.run(claim(), new AbortController().signal), error => error.code === "OUTPUT_LIMIT_EXCEEDED" && error.diagnostic.reason === "CLI_OUTPUT_TRUNCATED"); }
  finally { await h.cleanup(); }
});

test("a weekly bucket named in hours is not read as the 5-hour bucket", () => {
  const out = JSON.stringify({ groups: [{ name: "Gemini", buckets: [
    { window: "5h", remaining_fraction: 0.5, reset_time: "a" }, { window: "168 hours", remaining_fraction: 0.1, reset_time: "b" }] }] });
  const [group] = parseUsage(out);
  assert.equal(group.fiveHourRemaining, 0.5);
  assert.equal(group.weeklyRemaining, 0.1);
});

// ---- #5: a process that never closes its pipes cannot hang the worker ------------------------------------------

test("nodeExec gives up on a killed process whose pipes stay open", { skip: process.platform === "win32" }, async () => {
  // The parent exits when killed, but a detached grandchild keeps the inherited pipes open, so `close` never fires.
  const script = "require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},4000)'],{stdio:'inherit',detached:true}).unref();setTimeout(()=>{},60000)";
  const started = Date.now();
  const result = await nodeExec(process.execPath, ["-e", script], { timeoutMs: 200, hardStopMs: 300 });
  assert.equal(result.timedOut, true);
  assert.ok(Date.now() - started < 3000, "resolved by the hard stop, not by the grandchild exiting");
});

// ---- service ----------------------------------------------------------------------------------------------------

async function service({ run, requestHook, session = {}, jobs = 1 } = {}) {
  const root = await mkdtemp(join(tmpdir(), "nx-review-service-"));
  const directory = join(root, "journal");
  const queue = Array.from({ length: jobs }, (_, i) => ({ jobId: `j${i}`, attemptId: `a${i}`, leaseToken: `l${i}`, sourceUnits: [{ index: 0, text: "t" }], sourceLanguage: "vi",
    promptTemplate: "t", responseSchema: {}, profile: {}, maxInputBytes: 1e6, maxOutputBytes: 1e6, maxRuntimeMs: 1000 }));
  const requests = [];
  const notes = { rejected: 0, failures: [], running: 0 };
  const svc = new StoryAnalysisService(directory, {
    session: {
      eligibility: async () => ({ credentialRef: REF, maxParallel: 1 }),
      noteSuccess() {}, noteFailure: async error => { notes.failures.push(error.code); }, noteDeliveryProblem() {}, setRunning(count) { notes.running = count; },
      credentialRejected: async () => { notes.rejected++; },
      ...session,
    },
    request: async (path, body) => {
      requests.push({ path, body });
      if (requestHook) { const outcome = await requestHook(path, body); if (outcome !== undefined) return outcome; }
      return path.endsWith("/claim") ? queue.shift() ?? null : path.endsWith("/cancellation") ? false : null;
    },
    run: run ?? (async c => ({ leaseToken: c.leaseToken, rawJson: "{}", adapterVersion: "antigravity-cli/2", conversationId: null,
      usage: { promptTokens: 1, outputTokens: 1, thinkingTokens: 0, cachedTokens: 0, totalTokens: 2, runtimeMs: 1 } })),
    encrypt: v => Buffer.from(v), decrypt: b => b.toString(),
  });
  return { svc, directory, requests, notes, cleanup: async () => { await svc.shutdown(); await rm(root, { recursive: true, force: true }); } };
}
const sent = (h, suffix) => h.requests.filter(r => r.path.endsWith(suffix));

test("closing the app mid-run is reported as an interruption the person can re-run, never as a cancellation", async () => {
  // The real runner reports an aborted process as AMBIGUOUS_OUTCOME; an early abort check reports USER_CANCELLED.
  for (const thrown of [new AnalysisError("USER_CANCELLED", false), new AnalysisError("AMBIGUOUS_OUTCOME", true)]) {
    const h = await service({ run: (c, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(thrown))) });
    try {
      await h.svc.tick();
      await h.svc.shutdown(2000);
      const observation = sent(h, "/observation");
      assert.equal(observation.length, 1);
      assert.equal(observation[0].body.code, "APP_INTERRUPTED");
      assert.equal(observation[0].body.ambiguous, false);
      assert.deepEqual(h.notes.failures, [], "the shutdown does not put the session on hold");
    } finally { await h.cleanup(); }
  }
});

test("a slow quota refinement in noteFailure does not delay delivering the observation", async () => {
  let releaseNote;
  const h = await service({
    run: async () => { throw new AnalysisError("QUOTA_EXHAUSTED", false); },
    session: { noteFailure: () => new Promise(resolve => { releaseNote = resolve; }) },
  });
  try {
    await h.svc.tick();
    for (let i = 0; i < 50 && !sent(h, "/observation").length; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(sent(h, "/observation").length, 1, "observation sent while noteFailure is still pending");
    releaseNote();
    await h.svc.idle();
  } finally { await h.cleanup(); }
});

test("a definitive claim refusal leaves no journal and no pointless recover; a missing slot is re-registered", async () => {
  const h = await service({ requestHook: path => { if (path.endsWith("/claim")) throw new AnalysisBackendError(404); } });
  try {
    await h.svc.tick();
    await h.svc.tick();
    assert.equal(h.notes.rejected, 2);
    assert.equal(sent(h, "/recover").length, 0);
    assert.deepEqual((await readdir(h.directory)).filter(name => name.startsWith("pending-")), []);
  } finally { await h.cleanup(); }
});

test("a transient claim error still goes through recover", async () => {
  let fail = true;
  const h = await service({ requestHook: path => { if (path.endsWith("/claim") && fail) throw new AnalysisBackendError(503); } });
  try {
    await h.svc.tick();
    assert.equal((await readdir(h.directory)).filter(name => name.startsWith("pending-")).length, 1);
    fail = false;
    await h.svc.tick();
    assert.equal(sent(h, "/recover").length, 1);
    assert.equal(h.notes.rejected, 0);
  } finally { await h.cleanup(); }
});

test("old rejected and corrupt journal files are pruned, recent ones are kept", async () => {
  const h = await service();
  try {
    await mkdir(h.directory, { recursive: true });
    const old = join(h.directory, "a.rejected.encrypted"), fresh = join(h.directory, "b.rejected.encrypted"), corrupt = join(h.directory, `pending-${REF}.encrypted.corrupt`);
    for (const file of [old, fresh, corrupt]) await writeFile(file, "x");
    const longAgo = new Date(Date.now() - 40 * 24 * 3600_000);
    await utimes(old, longAgo, longAgo); await utimes(corrupt, longAgo, longAgo);
    h.svc.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual((await readdir(h.directory)).filter(name => !name.startsWith("pending-")).sort(), ["b.rejected.encrypted"]);
  } finally { await h.cleanup(); }
});

// ---- session ----------------------------------------------------------------------------------------------------

async function session(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "nx-review-session-"));
  const state = { requests: [], registrations: 0, usage: [{ family: "gemini", fiveHourRemaining: 0.8, fiveHourResetsAt: null, weeklyRemaining: 0.9, weeklyResetsAt: null }], usageCalls: 0, gate: null, now: Date.now(), ...overrides };
  const instance = new AgySession({
    directory, resolver: { resolve: async () => ({ ok: true, install: { path: "agy.exe", version: "1.3.5" } }) },
    runner: { usage: async () => { state.usageCalls++; await state.gate?.(); return state.usage; }, models: async () => [{ slug: "gemini-3.8-flash-high", family: "gemini" }] },
    request: async (path, body) => {
      state.requests.push({ path, body });
      if (state.requestGate && path.endsWith("/observation")) await state.requestGate(body);
      if (path.endsWith("analysis-credentials")) { state.registrations++; return { credentialRef: REF }; }
      return null;
    },
    configuration: async () => ({ executionMode: "ANTIGRAVITY_CLI", model: "gemini-3.8-flash-high", effort: "HIGH", maxConcurrentAnalyses: 1, rowVersion: 1 }),
    deviceReady: async () => true, ensureDevice: async () => {}, openConsole: async () => {}, isolationVerified: true, now: () => state.now,
  });
  return { instance, state, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test("a rejected credential slot is forgotten and registered again", async () => {
  const h = await session();
  try {
    await h.instance.eligibility();
    assert.equal(h.state.registrations, 1);
    await h.instance.credentialRejected();
    assert.equal((await h.instance.status()).credentialRef, null);
    await h.instance.eligibility();
    assert.equal(h.state.registrations, 2);
  } finally { await h.cleanup(); }
});

test("observations reach the backend in order, so a stale state never overwrites a newer one", async () => {
  const h = await session();
  try {
    await h.instance.eligibility();
    h.state.requests.length = 0;
    let first = true;
    h.state.requestGate = async () => { if (first) { first = false; await new Promise(resolve => setTimeout(resolve, 80)); } };
    await h.instance.noteFailure(new AnalysisError("RATE_LIMITED", false, 60_000));   // state A (slow to send)
    h.state.now += 61_000;
    h.instance.noteSuccess();                                                           // state B (must arrive after A)
    await new Promise(resolve => setTimeout(resolve, 250));
    const states = h.state.requests.filter(r => r.path.endsWith("/observation")).map(r => r.body.quotaState);
    assert.deepEqual(states, ["RATE_LIMITED", "AVAILABLE"]);
  } finally { await h.cleanup(); }
});

test("a forced refresh is not swallowed by a refresh that was already running", async () => {
  let release;
  const h = await session({ gate: () => new Promise(resolve => { release = resolve; }) });
  try {
    const background = h.instance.refresh(false);
    await new Promise(resolve => setTimeout(resolve, 20));
    const forced = h.instance.refresh(true);
    h.state.gate = null;
    release();
    await Promise.all([background, forced]);
    assert.equal(h.state.usageCalls, 2, "the forced refresh probed again");
  } finally { await h.cleanup(); }
});

test("a delivery notice does not erase a chapter error and is cleared once results are delivered", async () => {
  const h = await session();
  try {
    await h.instance.eligibility();
    await h.instance.noteFailure(new AnalysisError("SCHEMA_INVALID", false));
    h.instance.noteDeliveryProblem("RESULT_DELIVERY_PENDING");
    assert.equal((await h.instance.status()).lastError, "SCHEMA_INVALID");
    h.instance.noteDeliveryProblem(null);
    h.instance.noteSuccess();
    assert.equal((await h.instance.status()).lastError, null);
  } finally { await h.cleanup(); }
});

test("malformed or plain model stdout is never classified or logged as a CLI error", async () => {
  for (const stdout of ['{\n  "response": "PRIVATE CHAPTER: quota of bread"', "PRIVATE CHAPTER: permission and quota of bread"]) {
    const h = await runner(() => done(stdout, { exitCode: 1 }));
    try {
      await assert.rejects(h.instance.run(claim(), new AbortController().signal), error => error.code === "PROCESS_FAILED");
      assert.doesNotMatch(h.diagnostics[0].raw, /PRIVATE CHAPTER|bread/u);
    } finally { await h.cleanup(); }
  }
});

test("recovery retains journals until acknowledged, including authentication and payload rejections", async () => {
  for (const status of [400, 401, 403, 409, 422]) {
    let recoverError = status;
    const h = await service({ jobs: 0, requestHook: path => {
      if (path.endsWith("/claim")) throw new AnalysisBackendError(503);
      if (path.endsWith("/recover") && recoverError) throw new AnalysisBackendError(recoverError);
    } });
    try {
      await h.svc.tick();
      const before = (await readdir(h.directory)).filter(name => name.startsWith("pending-"));
      await h.svc.tick();
      assert.deepEqual((await readdir(h.directory)).filter(name => name.startsWith("pending-")), before, `retain after ${status}`);
      assert.equal(sent(h, "/claim").length, 1, "do not claim again before recovery is acknowledged");
      recoverError = null;
      h.svc.dependencies.session.eligibility = async () => null;
      await h.svc.tick();
      assert.deepEqual(await readdir(h.directory), []);
      assert.equal(sent(h, "/recover").length, 2);
    } finally { await h.cleanup(); }
  }
});

test("observation authentication failures keep the exact report for retry without new inference", async () => {
  for (const status of [401, 403]) {
    let refused = true, runs = 0;
    const h = await service({
      run: async () => { runs++; throw new AnalysisError("RATE_LIMITED", false); },
      requestHook: path => { if (path.endsWith("/observation") && refused) throw new AnalysisBackendError(status); },
    });
    try {
      await h.svc.tick(); await h.svc.idle();
      assert.equal((await readdir(h.directory)).filter(name => name.startsWith("pending-")).length, 1);
      refused = false;
      await h.svc.tick(); await h.svc.idle();
      const reports = sent(h, "/observation");
      assert.equal(reports.length, 2);
      assert.deepEqual(reports[1].body, reports[0].body);
      assert.equal(runs, 1);
      assert.deepEqual(await readdir(h.directory), []);
    } finally { await h.cleanup(); }
  }
});

test("a confirmed missing attempt closes its journal", async () => {
  for (const status of [404, 410]) {
    const h = await service({ jobs: 0, requestHook: path => {
      if (path.endsWith("/claim")) throw new AnalysisBackendError(503);
      if (path.endsWith("/recover")) throw new AnalysisBackendError(status);
    } });
    try {
      await h.svc.tick();
      h.svc.dependencies.session.eligibility = async () => null;
      await h.svc.tick();
      assert.deepEqual(await readdir(h.directory), []);
    } finally { await h.cleanup(); }
  }
});

test("failed journal cleanup releases the slot after both refused and empty claims", async () => {
  for (const refused of [true, false]) {
    let rejectClaim = refused;
    const h = await service({ requestHook: path => {
      if (path.endsWith("/claim") && rejectClaim) throw new AnalysisBackendError(404);
      if (path.endsWith("/claim") && !refused) return null;
    } });
    const clear = h.svc.clear.bind(h.svc);
    try {
      h.svc.clear = async () => { throw Object.assign(new Error("file locked"), { code: "EPERM" }); };
      await h.svc.tick();
      assert.equal(h.notes.running, 0);
      await h.svc.idle();
      h.svc.clear = clear; rejectClaim = false;
      await h.svc.tick(); await h.svc.idle();
      assert.equal(sent(h, "/recover").length, 1);
      assert.ok(sent(h, "/claim").length >= 2, "a free slot can claim again after recovery");
    } finally { h.svc.clear = clear; await h.cleanup(); }
  }
});

test("parallel successes preserve rate-limit and refusal hold-offs until expiry", async () => {
  for (const [code, duration] of [["RATE_LIMITED", 60_000], ["PROVIDER_REFUSAL", 30 * 60_000]]) {
    const h = await session();
    try {
      await h.instance.eligibility();
      await h.instance.noteFailure(new AnalysisError(code, false));
      const before = await h.instance.status();
      h.instance.noteSuccess();
      const after = await h.instance.status();
      assert.equal(after.quotaState, "RATE_LIMITED");
      assert.equal(after.nextEligibleAt, before.nextEligibleAt);
      assert.equal(await h.instance.eligibility(), null);
      h.state.now += duration + 1;
      assert.ok(await h.instance.eligibility(), "resume when the hold-off actually expires");
    } finally { await h.cleanup(); }
  }
});

test("forced callers queue one new probe even when the active probe is forced", async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const h = await session({ gate: () => { entered(); return new Promise(resolve => { release = resolve; }); } });
  try {
    const first = h.instance.refresh(true);
    await started;
    const second = h.instance.refresh(true);
    const third = h.instance.refresh(true);
    h.state.gate = null; release();
    await Promise.all([first, second, third]);
    assert.equal(h.state.usageCalls, 2);
  } finally { await h.cleanup(); }
});

test("a force requested during the queued probe gets a newer probe too", async () => {
  const entered = [], releases = [];
  const starts = Array.from({ length: 3 }, (_, i) => new Promise(resolve => { entered[i] = resolve; }));
  const h = await session({ gate: () => {
    const index = h.state.usageCalls - 1;
    entered[index]();
    return new Promise(resolve => { releases[index] = resolve; });
  } });
  try {
    const first = h.instance.refresh(true);
    await starts[0];
    const second = h.instance.refresh(true);
    releases[0]();
    await starts[1];
    const third = h.instance.refresh(true);
    releases[1]();
    await starts[2]; releases[2]();
    await Promise.all([first, second, third]);
    assert.equal(h.state.usageCalls, 3);
  } finally { for (const release of releases) release?.(); await h.cleanup(); }
});
