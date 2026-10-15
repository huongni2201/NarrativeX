import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AccountSessions } from "../src/main/story-analysis/account-sessions.ts";
import { AccountVault } from "../src/main/story-analysis/account-vault.ts";
import { buildRequest, classifyHttpFailure, generateProjectId, parseResponse, runAnalysis } from "../src/main/story-analysis/antigravity-api.ts";
import { validateProfile } from "../src/main/story-analysis/oauth-profile.ts";

const profile = validateProfile({ clientId: "1-a.apps.googleusercontent.com" }).profile;
const claim = {
  jobId: "job", projectId: "p", attemptId: "11111111-1111-1111-1111-111111111111", leaseToken: "lease",
  sourceText: "Lan đi qua con đường vắng.", sourceLanguage: "vi", promptTemplate: "Analyze.",
  responseSchema: { type: "object" }, profile: { model: "gemini-3.1-pro-high", effort: "HIGH", promptHash: "a", schemaHash: "b" },
  maxInputBytes: 100_000, maxOutputBytes: 100_000, maxRuntimeMs: 5_000,
};
const answer = (text, extra = {}) => ({ response: { candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }, ...extra } });
const tokens = (...values) => { const queue = [...values]; return { accessToken: async (_id, force) => (force ? "fresh" : queue.shift() ?? "token") }; };

test("request keeps the story as data, pins the model and never uses unrelated credentials", () => {
  const body = buildRequest(claim, "proj-123", profile);
  assert.equal(body.project, "proj-123");
  assert.equal(body.model, "gemini-3.1-pro-high");
  assert.match(body.requestId, /^agent\/[^/]+\/\d+\/[^/]+\/\d+$/);
  assert.match(body.request.contents[0].parts[0].text, /Lan đi qua/);
  assert.match(body.request.systemInstruction.parts[0].text, /untrusted/);
  assert.equal(body.request.generationConfig.responseMimeType, "application/json");
});

test("responses are unwrapped, fenced JSON is accepted and thought parts are ignored", () => {
  const done = parseResponse(answer('```json\n{"scenes":[]}\n```'), claim, 7);
  assert.equal(done.rawJson, '{"scenes":[]}');
  assert.equal(done.usage.promptTokens, 10);
  assert.equal(done.usage.thinkingTokens, null);
  assert.equal(done.usage.runtimeMs, 7);
  const withThought = { response: { candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text: '{"a":1}' }] } }] } };
  assert.equal(parseResponse(withThought, claim, 1).rawJson, '{"a":1}');
});

test("blocked, truncated, empty or non-object output is never accepted", () => {
  assert.throws(() => parseResponse({ response: { candidates: [{ finishReason: "SAFETY" }] } }, claim, 1), { code: "CONTENT_BLOCKED" });
  assert.throws(() => parseResponse({ response: { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } }] } }, claim, 1), { code: "OUTPUT_LIMIT_EXCEEDED" });
  assert.throws(() => parseResponse(answer("not json"), claim, 1), { code: "SCHEMA_INVALID" });
  assert.throws(() => parseResponse(answer("[1]"), claim, 1), { code: "SCHEMA_INVALID" });
  assert.throws(() => parseResponse({ response: { promptFeedback: { blockReason: "OTHER" } } }, claim, 1), { code: "CONTENT_BLOCKED" });
  assert.throws(() => parseResponse(answer('{"x":"' + "a".repeat(200_000) + '"}'), claim, 1), { code: "OUTPUT_LIMIT_EXCEEDED" });
});

test("HTTP failures map to stable codes; only server and transport faults stay ambiguous", () => {
  assert.equal(classifyHttpFailure(401, "", null).code, "AUTH_REQUIRED");
  assert.equal(classifyHttpFailure(429, "rate limit exceeded", "30").code, "RATE_LIMITED");
  assert.equal(classifyHttpFailure(429, "rate limit exceeded", "30").retryAfterMs, 30_000);
  assert.equal(classifyHttpFailure(429, "Resource has been exhausted (quota)", null).code, "QUOTA_EXHAUSTED");
  assert.equal(classifyHttpFailure(404, "", null).code, "MODEL_UNAVAILABLE");
  assert.equal(classifyHttpFailure(400, "invalid model name", null).code, "MODEL_UNAVAILABLE");
  assert.equal(classifyHttpFailure(500, "", null).ambiguous, true);
  assert.equal(classifyHttpFailure(401, "", null).ambiguous, false);
});

test("permission denials are not reported as revoked Google sessions and diagnostics contain no provider body", () => {
  for (const body of ["Permission denied: caller has no access to project", "not eligible", "", '{"error":{"message":"Bearer SECRET user@example.com story text"}}']) {
    const failure = classifyHttpFailure(403, body, null);
    assert.equal(failure.code, "PROVIDER_REFUSAL");
    assert.equal(failure.ambiguous, false);
    assert.deepEqual(failure.diagnostic, { source: "ANTIGRAVITY", httpStatus: 403, reason: null });
    assert.doesNotMatch(JSON.stringify(failure), /SECRET|user@example|story text/);
  }
});

test("a 403 sends only one inference request and does not refresh the Google token", async () => {
  let sends = 0, tokenReads = 0;
  await assert.rejects(runAnalysis({
    profile,
    tokens: { accessToken: async (_account, force) => { assert.ok(!force); tokenReads++; return "token"; } },
    fetch: async () => { sends++; return new Response("Permission denied", { status: 403 }); },
  }, "account", "project", claim, new AbortController().signal), error => {
    assert.equal(error.code, "PROVIDER_REFUSAL");
    assert.equal(error.diagnostic.httpStatus, 403);
    return true;
  });
  assert.deepEqual([sends, tokenReads], [1, 1]);
});

test("one generation request is sent; a 401 retries once with a refreshed token", async () => {
  const seen = [];
  const fetchStub = async (url, init) => {
    seen.push({ url: String(url), auth: init.headers.Authorization });
    return seen.length === 1 ? new Response("", { status: 401 }) : Response.json(answer('{"ok":true}'));
  };
  const done = await runAnalysis({ fetch: fetchStub, tokens: tokens("stale"), profile }, "acc", "proj", claim, new AbortController().signal);
  assert.equal(done.rawJson, '{"ok":true}');
  assert.deepEqual(seen.map(s => s.auth), ["Bearer stale", "Bearer fresh"]);
  assert.ok(seen.every(s => s.url === "https://cloudcode-pa.googleapis.com/v1internal:generateContent"));
});

test("a lost response after sending is ambiguous and a 5xx is never retried", async () => {
  let calls = 0;
  await assert.rejects(runAnalysis({ fetch: async () => { calls++; throw new TypeError("fetch failed"); }, tokens: tokens(), profile }, "a", "p", claim, new AbortController().signal), { code: "AMBIGUOUS_OUTCOME", ambiguous: true });
  await assert.rejects(runAnalysis({ fetch: async () => { calls++; return new Response("boom", { status: 503 }); }, tokens: tokens(), profile }, "a", "p", claim, new AbortController().signal), { code: "AMBIGUOUS_OUTCOME", ambiguous: true });
  assert.equal(calls, 2);
});

test("oversized input is rejected before any network request", async () => {
  await assert.rejects(runAnalysis({ fetch: async () => assert.fail("no request"), tokens: tokens(), profile }, "a", "p", { ...claim, maxInputBytes: 10 }, new AbortController().signal), { code: "INPUT_TOO_LARGE", ambiguous: false });
});

test("fallback project identifiers follow the 9Router format", () => {
  assert.match(generateProjectId(), /^(useful|bright|swift|calm|bold)-(fuze|wave|spark|flow|core)-[0-9a-f]{5}$/);
});

const crypto = { encrypt: value => Buffer.from(`enc:${value}`), decrypt: value => value.toString().replace(/^enc:/, "") };

test("vault stores secrets encrypted, deduplicates the same Google identity and removes everything", async t => {
  const directory = await mkdtemp(join(tmpdir(), "nx-vault-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const vault = new AccountVault(directory, crypto);
  const secrets = { refreshToken: "REFRESH-SECRET", accessToken: "ACCESS-SECRET", expiresAt: 1, scope: "s" };
  const first = await vault.upsert({ label: "h***@gmail.com", fingerprint: "a".repeat(64) }, secrets);
  const again = await vault.upsert({ label: "h***@gmail.com", fingerprint: "a".repeat(64) }, { ...secrets, accessToken: "NEW" });
  const second = await vault.upsert({ label: "x***@gmail.com", fingerprint: "b".repeat(64) }, secrets);
  assert.equal(first.accountId, again.accountId);
  assert.notEqual(first.accountId, second.accountId);
  assert.equal((await vault.list()).length, 2);
  assert.equal((await vault.secrets(first.accountId)).accessToken, "NEW");
  assert.doesNotMatch(await readFile(join(directory, "accounts.json"), "utf8"), /SECRET|NEW/);
  assert.match(await readFile(join(directory, "secrets", `${first.accountId}.encrypted`), "utf8"), /^enc:/);
  await assert.rejects(vault.secrets("../evil"), /Invalid account id/);
  assert.equal(await vault.remove(first.accountId), true);
  assert.equal(await vault.secrets(first.accountId), null);
  assert.deepEqual(await readdir(join(directory, "secrets")), [`${second.accountId}.encrypted`]);
});

test("token refresh is serialized per account, persisted, and an invalid grant requires login", async t => {
  const directory = await mkdtemp(join(tmpdir(), "nx-sessions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const vault = new AccountVault(directory, crypto);
  const account = await vault.upsert({ label: "l", fingerprint: "c".repeat(64) }, { refreshToken: "r", accessToken: "old", expiresAt: 0, scope: "s" });
  let refreshes = 0, mode = "ok";
  const deps = { now: () => 10_000, fetch: async () => {
    refreshes++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return mode === "ok" ? Response.json({ access_token: "new", expires_in: 3600, scope: "s" }) : Response.json({ error: "invalid_grant" }, { status: 400 });
  } };
  const sessions = new AccountSessions(vault, async () => ({ ok: true, profile }), deps);
  const [a, b] = await Promise.all([sessions.accessToken(account.accountId), sessions.accessToken(account.accountId)]);
  assert.deepEqual([a, b, refreshes], ["new", "new", 1]);
  assert.equal(await sessions.accessToken(account.accountId), "new");
  assert.equal(refreshes, 1);
  assert.equal((await vault.secrets(account.accountId)).refreshToken, "r");
  mode = "revoked";
  await assert.rejects(sessions.accessToken(account.accountId, true), error => {
    assert.equal(error.code, "AUTH_REQUIRED");
    assert.deepEqual(error.diagnostic, { source: "GOOGLE_OAUTH", httpStatus: 400, reason: "INVALID_GRANT" });
    return true;
  });
});
