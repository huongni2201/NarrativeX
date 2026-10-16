import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgySession } from "../src/main/story-analysis/agy-session.ts";
import { AnalysisBackendError, AnalysisError } from "../src/main/story-analysis/types.ts";

const T0 = Date.parse("2026-10-15T00:00:00Z");
const group = (family, five, fiveReset, week = 0.9, weekReset = "2026-10-22T00:00:00Z") =>
  ({ family, fiveHourRemaining: five, fiveHourResetsAt: fiveReset, weeklyRemaining: week, weeklyResetsAt: weekReset });
const MODELS = [{ slug: "gemini-3.8-flash-high", family: "gemini" }, { slug: "claude-sonnet-4-6", family: "third-party" }];

async function build(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "nx-agy-session-"));
  const state = {
    now: T0, usage: [group("gemini", 0.8, "2026-10-15T05:00:00Z")], models: MODELS, usageError: null,
    config: { executionMode: "ANTIGRAVITY_CLI", model: "gemini-3.8-flash-high", effort: "HIGH", maxConcurrentAnalyses: 2, rowVersion: 1 },
    deviceReady: true, requests: [], registerFailures: [], opened: [],
    ...overrides,
  };
  const session = new AgySession({
    directory,
    resolver: { resolve: async () => state.install ?? { ok: true, install: { path: "agy.exe", version: "1.3.5" } } },
    runner: {
      usage: async () => { if (state.usageError) throw state.usageError; return state.usage; },
      models: async () => state.models,
    },
    request: async (path, body) => {
      state.requests.push({ path, body });
      if (path.endsWith("analysis-credentials") && state.registerFailures.length) throw state.registerFailures.shift();
      return path.endsWith("analysis-credentials") ? { credentialRef: "11111111-1111-4111-8111-111111111111" } : null;
    },
    configuration: async () => state.config,
    deviceReady: async () => state.deviceReady,
    ensureDevice: async () => { state.deviceReady = true; state.paired = true; },
    openConsole: async path => { state.opened.push(path); },
    isolationVerified: true,
    now: () => state.now,
    ...(overrides.deps ?? {}),
  });
  return { session, state, directory, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test("a ready session registers one credential, mirrors its state and allows min(configured, 3) chapters", async () => {
  const h = await build({ config: { executionMode: "ANTIGRAVITY_CLI", model: "gemini-3.8-flash-high", effort: "HIGH", maxConcurrentAnalyses: 8, rowVersion: 1 } });
  try {
    const eligibility = await h.session.eligibility();
    assert.deepEqual(eligibility, { credentialRef: "11111111-1111-4111-8111-111111111111", maxParallel: 3 });
    const registration = h.state.requests.find(r => r.path.endsWith("analysis-credentials"));
    assert.equal(registration.body.label, "Antigravity CLI");
    assert.equal(registration.body.adapterVersion, "antigravity-cli/2");
    assert.deepEqual(registration.body.models, ["gemini-3.8-flash-high", "claude-sonnet-4-6"]);
    const stored = JSON.parse(await readFile(join(h.directory, "session.json"), "utf8"));
    assert.equal(registration.body.fingerprint, createHash("sha256").update(`agy-cli:${stored.installationId}`).digest("hex"));
    assert.equal(stored.credentialRef, "11111111-1111-4111-8111-111111111111");
    const observation = h.state.requests.find(r => r.path.endsWith("/observation"));
    assert.equal(observation.body.connectionState, "CONNECTED");
    assert.equal(observation.body.quotaState, "AVAILABLE");
    assert.doesNotMatch(await readFile(join(h.directory, "session.json"), "utf8"), /token/i);

    await h.session.eligibility();
    assert.equal(h.state.requests.filter(r => r.path.endsWith("analysis-credentials")).length, 1, "registered once per process");
  } finally { await h.cleanup(); }
});

test("claims stay paused until agy is installed, logged in, verified and the model exists", async () => {
  const missing = await build({ install: { ok: false, issue: "AGY_NOT_FOUND" } });
  try {
    assert.equal(await missing.session.eligibility(), null);
    const status = await missing.session.status();
    assert.equal(status.cliReady, false);
    assert.equal(status.lastError, "AGY_NOT_FOUND");
  } finally { await missing.cleanup(); }

  const loggedOut = await build({ usageError: new AnalysisError("AUTH_REQUIRED", false) });
  try {
    assert.equal(await loggedOut.session.eligibility(), null);
    const status = await loggedOut.session.status();
    assert.equal(status.loggedIn, false);
    assert.equal(status.connectionState, "AUTH_REQUIRED");
    assert.equal(loggedOut.state.requests.length, 0, "nothing is registered while logged out");
  } finally { await loggedOut.cleanup(); }

  const wrongModel = await build({ config: { executionMode: "ANTIGRAVITY_CLI", model: "gemini-3.8-flash", effort: "HIGH", maxConcurrentAnalyses: 2, rowVersion: 1 } });
  try {
    assert.equal(await wrongModel.session.eligibility(), null);
    assert.equal((await wrongModel.session.status()).modelIssue, "MODEL_NOT_AVAILABLE");
  } finally { await wrongModel.cleanup(); }

  const locked = await build({ deps: { isolationVerified: false } });
  try {
    assert.equal(await locked.session.eligibility(), null);
    assert.equal((await locked.session.status()).lastError, "ISOLATION_NOT_VERIFIED");
  } finally { await locked.cleanup(); }
});

test("an exhausted bucket pauses claims until its reset", async () => {
  const h = await build({ usage: [group("gemini", 0.01, "2026-10-15T05:00:00Z")] });
  try {
    assert.equal(await h.session.eligibility(), null);
    const status = await h.session.status();
    assert.equal(status.quotaState, "EXHAUSTED");
    assert.equal(status.nextEligibleAt, "2026-10-15T05:00:00.000Z");
    assert.equal(status.lastError, "QUOTA_EXHAUSTED");
  } finally { await h.cleanup(); }
});

test("quota and rate-limit failures hold off claims; chapter-local failures do not", async () => {
  const h = await build();
  try {
    await h.session.eligibility();
    await h.session.noteFailure(new AnalysisError("SCHEMA_INVALID", false));
    assert.ok(await h.session.eligibility(), "a bad chapter result does not pause the session");

    await h.session.noteFailure(new AnalysisError("RATE_LIMITED", false, 60_000));
    assert.equal(await h.session.eligibility(), null);
    h.state.now += 61_000;
    assert.ok(await h.session.eligibility());

    h.state.usage = [group("gemini", 0.0, "2026-10-15T09:00:00Z")];
    await h.session.noteFailure(new AnalysisError("QUOTA_EXHAUSTED", false));
    const status = await h.session.status();
    assert.equal(status.quotaState, "EXHAUSTED");
    assert.equal(status.nextEligibleAt, "2026-10-15T09:00:00.000Z");
    assert.equal(await h.session.eligibility(), null);

    h.state.now = Date.parse("2026-10-15T09:00:01Z");
    h.state.usage = [group("gemini", 1, "2026-10-15T14:00:00Z")];
    await h.session.status(true);
    assert.ok(await h.session.eligibility(), "resumes after the reset time");
  } finally { await h.cleanup(); }
});

test("a refusal pauses for 30 minutes except when only a tool was denied", async () => {
  const h = await build();
  try {
    await h.session.eligibility();
    await h.session.noteFailure(new AnalysisError("TOOL_DENIED", false, null, { source: "AGY_CLI", exitCode: 0, reason: "TOOL_DENIED" }));
    assert.ok(await h.session.eligibility());
    await h.session.noteFailure(new AnalysisError("PROVIDER_REFUSAL", false, null, { source: "AGY_CLI", exitCode: 1, reason: "REFUSED" }));
    assert.equal(await h.session.eligibility(), null);
    h.state.now += 29 * 60_000;
    assert.equal(await h.session.eligibility(), null);
    h.state.now += 2 * 60_000;
    assert.ok(await h.session.eligibility());
  } finally { await h.cleanup(); }
});

test("a legacy fingerprint is reused when the backend already holds this Desktop's slot", async () => {
  const h = await build({ registerFailures: [new AnalysisBackendError(409)] });
  try {
    const legacyId = "22222222-2222-4222-8222-222222222222";
    await writeFile(join(h.directory, "agy-installation-id"), legacyId);
    assert.ok(await h.session.eligibility());
    const registrations = h.state.requests.filter(r => r.path.endsWith("analysis-credentials"));
    assert.equal(registrations.length, 2);
    assert.equal(registrations[1].body.fingerprint, createHash("sha256").update(legacyId).digest("hex"));
  } finally { await h.cleanup(); }
});

test("an unpaired Desktop is paired on demand and the login console opens agy itself", async () => {
  const h = await build({ deviceReady: false });
  try {
    assert.ok(await h.session.eligibility());
    assert.equal(h.state.paired, true);
    await h.session.openAgy();
    assert.deepEqual(h.state.opened, ["agy.exe"]);
  } finally { await h.cleanup(); }
});
