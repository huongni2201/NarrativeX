import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AccountManager } from "../src/main/story-analysis/accounts.ts";
import { AccountVault } from "../src/main/story-analysis/account-vault.ts";
import { AnalysisBackendError, StoryAnalysisService } from "../src/main/story-analysis/service.ts";
import { ADAPTER_VERSION, AnalysisError } from "../src/main/story-analysis/types.ts";
import { classifyHttpFailure, runAnalysis } from "../src/main/story-analysis/antigravity-api.ts";
import { validateProfile } from "../src/main/story-analysis/oauth-profile.ts";

const profile = validateProfile({ clientId: "1-a.apps.googleusercontent.com" }).profile;
const crypto = { encrypt: value => Buffer.from(`enc:${value}`), decrypt: value => value.toString().replace(/^enc:/, "") };
const secrets = { refreshToken: "r", accessToken: "a", expiresAt: Date.now() + 3_600_000, scope: "s" };
const claimFor = n => ({
  jobId: `job-${n}`, projectId: "p", attemptId: `attempt-${n}`, leaseToken: `lease-${n}`, sourceText: "Truyện", sourceLanguage: "vi",
  promptTemplate: "x", responseSchema: {}, profile: { model: "m", effort: "HIGH", promptHash: "a", schemaHash: "b" },
  maxInputBytes: 1e5, maxOutputBytes: 1e5, maxRuntimeMs: 5_000,
});
const completionFor = claim => ({ leaseToken: claim.leaseToken, rawJson: "{}", adapterVersion: ADAPTER_VERSION, conversationId: claim.attemptId, usage: { runtimeMs: 1 } });

async function setup(t, count, { projectId = "project-123" } = {}) {
  const root = await mkdtemp(join(tmpdir(), "nx-service-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const vault = new AccountVault(join(root, "accounts"), crypto);
  const registered = [];
  for (let i = 0; i < count; i++) {
    registered.push(await vault.upsert({ label: `u${i}***@gmail.com`, fingerprint: String(i).padStart(64, "0") }, secrets));
  }
  const requests = [];
  const manager = new AccountManager({
    vault, profile: async () => ({ ok: true, profile }), oauth: { fetch: async () => assert.fail("preparing an account must not call the provider"), openUrl: async () => {} },
    ready: async () => true, ensureDevice: async () => {},
    request: async (path, body) => {
      requests.push({ path, body });
      if (path.endsWith("/analysis-credentials")) return { credentialRef: `ref-${body.fingerprint.slice(-2)}` };
      return null;
    },
  });
  for (const account of registered) await vault.patch(account.accountId, { projectId });
  return { root, vault, manager, requests, registered, journal: join(root, "journal") };
}

test("missing project IDs are generated once per account, persisted and reused after restart", async t => {
  const { root, manager, registered, vault, requests } = await setup(t, 2, { projectId: null });
  const accountId = registered[0].accountId;
  manager.update(accountId, { connectionState: "UNAVAILABLE", lastError: "PROVIDER_UNAVAILABLE" });
  const [first, overlapping] = await Promise.all([manager.prepare(accountId), manager.prepare(accountId)]);
  assert.deepEqual(first, overlapping);
  assert.match(first.projectId, /^(useful|bright|swift|calm|bold)-(fuze|wave|spark|flow|core)-[0-9a-f]{5}$/);
  const second = await manager.prepare(registered[1].accountId);
  assert.notEqual(second.projectId, first.projectId);
  assert.deepEqual(await manager.prepare(accountId), first);
  assert.equal(requests.filter(r => r.path.endsWith("/analysis-credentials")).length, 2);
  assert.equal((await manager.status()).accounts[0].connectionState, "CONNECTED");
  assert.equal(manager.runtime(accountId).lastError, null);

  const reopenedVault = new AccountVault(join(root, "accounts"), crypto);
  const restarted = new AccountManager({
    vault: reopenedVault, profile: async () => ({ ok: true, profile }),
    oauth: { fetch: async () => assert.fail("no provider lookup"), openUrl: async () => {} },
    ready: async () => true, ensureDevice: async () => {}, request: async () => assert.fail("already registered"),
  });
  assert.deepEqual(await restarted.prepare(accountId), first);
  assert.equal((await vault.list())[0].projectId, first.projectId);
});

test("an existing project ID is preserved", async t => {
  const { manager, registered, vault } = await setup(t, 1, { projectId: "provider-project-123" });
  assert.equal((await manager.prepare(registered[0].accountId)).projectId, "provider-project-123");
  assert.equal((await vault.list())[0].projectId, "provider-project-123");
});

test("generated projects go directly to inference with a new session for each analysis", async t => {
  const { manager, journal, registered } = await setup(t, 1, { projectId: null });
  const seen = [];
  let claims = 0;
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => true, ...crypto,
    request: async path => path.endsWith("/claim") ? claimFor(++claims) : null,
    run: (accountId, projectId, claim, signal) => runAnalysis({
      profile, tokens: { accessToken: async () => "token" },
      fetch: async (url, init) => {
        seen.push({ url, body: JSON.parse(init.body) });
        return Response.json({ candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] });
      },
    }, accountId, projectId, claim, signal),
  });
  await service.tick();
  await service.tick();
  assert.equal(seen.length, 2);
  assert.ok(seen.every(r => r.url === "https://cloudcode-pa.googleapis.com/v1internal:generateContent"));
  const stored = (await manager.list()).find(a => a.accountId === registered[0].accountId);
  assert.ok(seen.every(r => r.body.project === stored.projectId));
  assert.deepEqual(seen.map(r => r.body.request.sessionId), ["attempt-1", "attempt-2"]);
  assert.deepEqual(await readdir(journal), []);
});

test("a provider permission denial preserves the Google session and exposes only safe HTTP diagnostics", async t => {
  const { manager, journal, registered, requests, vault } = await setup(t, 1);
  let claims = 0, denied = true;
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => true, ...crypto,
    request: async (path, body) => { requests.push({ path, body }); return path.endsWith("/claim") ? claimFor(++claims) : null; },
    run: async (_account, _project, claim) => {
      if (denied) throw classifyHttpFailure(403, "Permission denied Bearer SECRET", null);
      return completionFor(claim);
    },
  });
  await service.tick();
  const status = (await manager.status()).accounts[0];
  assert.equal(status.connectionState, "CONNECTED");
  assert.equal(status.lastError, "PROVIDER_REFUSAL");
  assert.deepEqual(status.lastDiagnostic, { source: "ANTIGRAVITY", httpStatus: 403, reason: null });
  assert.doesNotMatch(JSON.stringify(status), /SECRET/);
  assert.deepEqual(await vault.secrets(registered[0].accountId), secrets);
  const observation = requests.find(r => r.path.includes("/chapter-analyses/") && r.path.endsWith("/observation"));
  assert.equal(observation.body.code, "PROVIDER_REFUSAL");
  assert.ok(!("diagnostic" in observation.body), "Diagnostics stay local");
  denied = false;
  await service.tick();
  assert.equal(claims, 2, "A permission error must not require another Google login");
  assert.equal((await manager.status()).accounts[0].lastError, null);
  assert.equal((await manager.status()).accounts[0].lastDiagnostic, null);
});

test("accounts analyse in parallel, one job each, and the backend is asked per credential", async t => {
  const { manager, requests, registered, journal } = await setup(t, 3);
  const queue = [1, 2, 3];
  let running = 0, peak = 0;
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => true, ...crypto,
    request: async (path, body) => {
      requests.push({ path, body });
      if (path.endsWith("/claim")) return queue.length ? claimFor(queue.shift()) : null;
      return null;
    },
    run: async (_account, _project, claim) => {
      running++; peak = Math.max(peak, running);
      await new Promise(resolve => setTimeout(resolve, 40));
      running--; return completionFor(claim);
    },
  });
  await service.tick();
  assert.equal(peak, 3);
  const claims = requests.filter(r => r.path.endsWith("/claim"));
  assert.equal(new Set(claims.map(c => c.body.credentialRef)).size, 3);
  assert.equal(requests.filter(r => r.path.endsWith("/complete")).length, 3);
  assert.deepEqual(await readdir(journal), []);
  assert.ok(registered.every(a => manager.runtime(a.accountId).activeJobId === null));
});

test("an account never runs two analyses at once even when ticks overlap", async t => {
  const { manager, journal } = await setup(t, 1);
  let running = 0, peak = 0, claims = 0;
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => true, ...crypto,
    request: async path => path.endsWith("/claim") ? claimFor(++claims) : null,
    run: async (_a, _p, claim) => { running++; peak = Math.max(peak, running); await new Promise(r => setTimeout(r, 30)); running--; return completionFor(claim); },
  });
  await Promise.all([service.tick(), service.tick(), service.tick()]);
  assert.equal(peak, 1);
});

test("failed delivery and Desktop restart replay the saved result without a second inference", async t => {
  const { manager, journal, registered } = await setup(t, 1);
  let runs = 0, deliveries = 0, claims = 0;
  const dependencies = {
    accounts: manager, ready: async () => true, ...crypto,
    run: async (_a, _p, claim) => { runs++; return completionFor(claim); },
    request: async path => {
      if (path.endsWith("/claim")) { claims++; return claimFor(1); }
      if (path.endsWith("/complete")) { deliveries++; if (deliveries === 1) throw Error("network disconnected"); }
      return null;
    },
  };
  await new StoryAnalysisService(journal, dependencies).tick();
  const file = join(journal, `pending-${registered[0].accountId}.encrypted`);
  assert.match(await readFile(file, "utf8"), /rawJson/);
  await new StoryAnalysisService(journal, dependencies).tick();
  assert.deepEqual([runs, deliveries, claims], [1, 2, 1]);
  await assert.rejects(readFile(file), { code: "ENOENT" });
});

test("a lost claim ACK is reconciled on restart without running inference", async t => {
  const { manager, journal } = await setup(t, 1);
  let runs = 0, recovered = 0;
  const dependencies = {
    accounts: manager, ready: async () => true, ...crypto,
    run: async () => { runs++; throw Error("must not run"); },
    request: async path => { if (path.endsWith("/claim")) throw Error("lost ACK"); if (path.endsWith("/recover")) recovered++; return null; },
  };
  await new StoryAnalysisService(journal, dependencies).tick();
  await new StoryAnalysisService(journal, dependencies).tick();
  assert.deepEqual([runs, recovered], [0, 1]);
});

test("an unpaired Desktop creates no claim, journal or inference", async t => {
  const { manager, journal } = await setup(t, 2);
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => false, ...crypto,
    request: async () => assert.fail("Unpaired Desktop cannot claim jobs"), run: async () => assert.fail("no inference"),
  });
  await service.tick();
  await assert.rejects(readdir(journal), { code: "ENOENT" });
});

test("an ambiguous provider outcome is reported to the backend and never resubmitted", async t => {
  const { manager, journal, registered, requests } = await setup(t, 1);
  let runs = 0;
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => true, ...crypto,
    run: async () => { runs++; throw new AnalysisError("AMBIGUOUS_OUTCOME", true); },
    request: async (path, body) => { requests.push({ path, body }); return path.endsWith("/claim") ? claimFor(1) : null; },
  });
  await service.tick();
  const observation = requests.find(r => r.path.includes("/chapter-analyses/") && r.path.endsWith("/observation"));
  assert.deepEqual([observation.body.code, observation.body.ambiguous, runs], ["AMBIGUOUS_OUTCOME", true, 1]);
  assert.equal(manager.runtime(registered[0].accountId).lastError, "AMBIGUOUS_OUTCOME");
});

test("rate limits and exhausted quota hold only the affected account; others keep claiming", async t => {
  const { manager, journal, registered, requests } = await setup(t, 2);
  let now = 1_000_000;
  const claimedBy = [];
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => true, ...crypto, now: () => now,
    request: async (path, body) => { requests.push({ path, body }); if (path.endsWith("/claim")) { claimedBy.push(body.credentialRef); return claimFor(claimedBy.length); } return null; },
    run: async (accountId, _p, claim) => {
      if (accountId === registered[0].accountId) throw new AnalysisError("RATE_LIMITED", false, 30_000);
      return completionFor(claim);
    },
  });
  await service.tick();
  const limited = manager.runtime(registered[0].accountId);
  assert.equal(limited.quotaState, "RATE_LIMITED");
  assert.equal(limited.nextEligibleAt, now + 30_000);
  claimedBy.length = 0;
  await service.tick();
  assert.equal(claimedBy.length, 1, "only the healthy account claims during the hold-off");
  assert.notEqual(claimedBy[0], `ref-${registered[0].fingerprint.slice(-2)}`);
  now += 31_000;
  claimedBy.length = 0;
  await service.tick();
  assert.equal(claimedBy.length, 2);
  assert.ok(requests.some(r => r.path.endsWith("/observation") && r.body.quotaState === "RATE_LIMITED"));
});

test("an account whose Google session expired stops claiming until the user signs in again", async t => {
  const { manager, journal, registered } = await setup(t, 1);
  let claims = 0;
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => true, ...crypto,
    request: async path => { if (path.endsWith("/claim")) { claims++; return claimFor(claims); } return null; },
    run: async () => { throw new AnalysisError("AUTH_REQUIRED", false); },
  });
  await service.tick();
  await service.tick();
  assert.equal(claims, 1);
  assert.equal(manager.runtime(registered[0].accountId).connectionState, "AUTH_REQUIRED");
  assert.equal((await manager.status()).accounts[0].connectionState, "AUTH_REQUIRED");
});

test("a result the backend rejects is kept encrypted and is not regenerated", async t => {
  const { manager, journal, registered } = await setup(t, 1);
  let runs = 0, claimed = false;
  const service = new StoryAnalysisService(journal, {
    accounts: manager, ready: async () => true, ...crypto,
    run: async (_a, _p, claim) => { runs++; return completionFor(claim); },
    request: async path => {
      if (path.endsWith("/claim")) { if (claimed) return null; claimed = true; return claimFor(1); }
      if (path.endsWith("/complete")) throw new AnalysisBackendError(422);
      if (path.endsWith("/cancellation")) return false;
      return null;
    },
  });
  await service.tick();
  await service.tick();
  assert.equal(runs, 1);
  assert.equal(manager.runtime(registered[0].accountId).lastError, "SCHEMA_INVALID");
  assert.ok((await readdir(journal)).some(name => name.endsWith(".rejected.encrypted")));
});

test("registering an account sends only a fingerprint and masked label; removing retires the credential", async t => {
  const { manager, requests, registered, vault } = await setup(t, 1);
  const prepared = await manager.prepare(registered[0].accountId);
  assert.match(prepared.credentialRef, /^ref-/);
  const call = requests.find(r => r.path.endsWith("/analysis-credentials"));
  assert.match(call.body.fingerprint, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(call.body), /refresh|access|token|@gmail\.com$/i);
  assert.equal((await vault.list())[0].credentialRef, prepared.credentialRef);
  assert.equal((await manager.status()).accounts[0].connectionState, "CONNECTED");
  manager.update(registered[0].accountId, { activeJobId: "busy" });
  await assert.rejects(manager.removeAccount(registered[0].accountId), /ANALYSIS_IN_PROGRESS/);
  manager.update(registered[0].accountId, { activeJobId: null });
  const status = await manager.removeAccount(registered[0].accountId);
  assert.equal(status.accounts.length, 0);
  assert.ok(requests.some(r => r.path.endsWith(`/analysis-credentials/${prepared.credentialRef}/retire`)));
});

test("without an OAuth client profile the status says so and no account can be added", async t => {
  const { vault } = await setup(t, 0);
  const manager = new AccountManager({
    vault, profile: async () => ({ ok: false, issue: "OAUTH_CLIENT_MISSING" }), oauth: { fetch, openUrl: async () => assert.fail("no browser") },
    ready: async () => true, ensureDevice: async () => {}, request: async () => null,
  });
  const status = await manager.status();
  assert.deepEqual([status.configured, status.profileIssue], [false, "OAUTH_CLIENT_MISSING"]);
  await assert.rejects(manager.addAccount(), { code: "OAUTH_NOT_CONFIGURED" });
});
