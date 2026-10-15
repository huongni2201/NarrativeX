import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildAuthorizationUrl, createPkcePair, fingerprintOf, loginWithGoogle, maskEmail, missingScopes, startCallbackServer,
} from "../src/main/story-analysis/oauth-flow.ts";
import { loadProfile, validateProfile } from "../src/main/story-analysis/oauth-profile.ts";

const CLIENT = "1234567890-abc.apps.googleusercontent.com";
const profile = validateProfile({ clientId: CLIENT, clientSecret: "secret" }).profile;

test("PKCE challenge is the S256 hash of the verifier", () => {
  const { verifier, challenge } = createPkcePair();
  assert.ok(verifier.length >= 43);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
});

test("authorization URL forces the account chooser, offline access and PKCE", () => {
  const url = new URL(buildAuthorizationUrl(profile, "http://127.0.0.1:1/callback", "state-1", "challenge-1"));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), CLIENT);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.match(url.searchParams.get("prompt"), /select_account/);
  assert.equal(url.searchParams.get("state"), "state-1");
});

test("profile validation never allows tokens to leave googleapis.com over HTTPS", () => {
  assert.equal(validateProfile({}).issue, "OAUTH_CLIENT_MISSING");
  assert.equal(validateProfile({ clientId: "nope" }).issue, "OAUTH_CLIENT_INVALID");
  assert.equal(validateProfile({ clientId: CLIENT, apiBaseUrl: "http://cloudcode-pa.googleapis.com" }).issue, "API_BASE_URL_INVALID");
  assert.equal(validateProfile({ clientId: CLIENT, apiBaseUrl: "https://evil.example.com" }).issue, "API_BASE_URL_INVALID");
  assert.equal(validateProfile({ clientId: CLIENT, apiBaseUrl: "https://googleapis.com.evil.com" }).issue, "API_BASE_URL_INVALID");
  assert.equal(validateProfile({ clientId: CLIENT, scopes: ["https://evil.example/scope"] }).issue, "OAUTH_SCOPE_INVALID");
  assert.equal(validateProfile({ clientId: CLIENT }).profile.apiBaseUrl, "https://cloudcode-pa.googleapis.com");
});

test("profile file and environment override are loaded; a missing client is reported, not defaulted", async t => {
  const directory = await mkdtemp(join(tmpdir(), "nx-profile-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  assert.equal((await loadProfile(directory, {})).issue, "OAUTH_CLIENT_MISSING");
  await writeFile(join(directory, "oauth-client.json"), JSON.stringify({ clientId: CLIENT }));
  assert.equal((await loadProfile(directory, {})).ok, true);
  const overridden = await loadProfile(directory, { NARRATIVEX_ANTIGRAVITY_CLIENT_ID: "999-x.apps.googleusercontent.com" });
  assert.equal(overridden.profile.clientId, "999-x.apps.googleusercontent.com");
  await writeFile(join(directory, "oauth-client.json"), "{");
  assert.equal((await loadProfile(directory, {})).issue, "OAUTH_PROFILE_INVALID");
});

test("callback server accepts only the matching state on the callback route and host", async () => {
  const receiver = startCallbackServer("good-state", 5_000);
  const redirect = await receiver.redirectUri;
  const base = new URL(redirect).origin;
  assert.equal((await fetch(`${base}/other?state=good-state&code=x`)).status, 404);
  assert.equal((await fetch(`${redirect}?state=bad&code=x`)).status, 400);
  assert.equal((await fetch(`${redirect}?state=good-state&code=the-code`)).status, 200);
  assert.equal(await receiver.code, "the-code");
});

test("denied consent and timeouts reject cleanly", async () => {
  const denied = startCallbackServer("s", 5_000);
  const redirect = await denied.redirectUri;
  await fetch(`${redirect}?state=s&error=access_denied`);
  await assert.rejects(denied.code, { code: "LOGIN_DENIED" });
  const slow = startCallbackServer("s", 30);
  await assert.rejects(slow.code, { code: "LOGIN_TIMEOUT" });
  const controller = new AbortController();
  const cancelled = startCallbackServer("s", 5_000, controller.signal);
  controller.abort();
  await assert.rejects(cancelled.code, { code: "LOGIN_CANCELLED" });
});

function fakeGoogle({ scope = "openid email profile https://www.googleapis.com/auth/cloud-platform", refresh = "refresh-1" } = {}) {
  const calls = [];
  const fetchStub = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? String(init.body) : "" });
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "access-1", refresh_token: refresh, expires_in: 3600, scope });
    }
    if (String(url).includes("openidconnect.googleapis.com")) return Response.json({ sub: "sub-123", email: "huong@gmail.com" });
    return new Response("unexpected", { status: 500 });
  };
  return { calls, fetch: fetchStub };
}

async function browserVisit(authorizationUrl) {
  const url = new URL(authorizationUrl);
  const redirect = url.searchParams.get("redirect_uri");
  await fetch(`${redirect}?code=auth-code&state=${url.searchParams.get("state")}`);
}

test("login exchanges the code with the PKCE verifier and returns tokens plus identity", async () => {
  const google = fakeGoogle();
  const result = await loginWithGoogle(profile, { fetch: google.fetch, openUrl: browserVisit, now: () => 1_000 });
  assert.equal(result.tokens.accessToken, "access-1");
  assert.equal(result.tokens.expiresAt, 1_000 + 3_600_000);
  assert.equal(result.identity.subject, "sub-123");
  const exchange = new URLSearchParams(google.calls[0].body);
  assert.equal(exchange.get("grant_type"), "authorization_code");
  assert.equal(exchange.get("code"), "auth-code");
  assert.ok(exchange.get("code_verifier").length >= 43);
  assert.equal(exchange.get("client_secret"), "secret");
});

test("a consent screen with an unchecked scope or no refresh token does not create an account", async () => {
  await assert.rejects(loginWithGoogle(profile, { fetch: fakeGoogle({ scope: "openid email" }).fetch, openUrl: browserVisit }), { code: "SCOPE_NOT_GRANTED" });
  await assert.rejects(loginWithGoogle(profile, { fetch: fakeGoogle({ refresh: null }).fetch, openUrl: browserVisit }), { code: "NO_REFRESH_TOKEN" });
});

test("helpers mask e-mail, hash identities and list only missing non-OpenID scopes", () => {
  assert.equal(maskEmail("huong@gmail.com"), "h***@gmail.com");
  assert.equal(maskEmail(null), "Tài khoản Google");
  assert.match(fingerprintOf("sub-1"), /^[0-9a-f]{64}$/);
  assert.notEqual(fingerprintOf("sub-1"), fingerprintOf("sub-2"));
  assert.deepEqual(missingScopes(["openid", "https://www.googleapis.com/auth/cloud-platform"], "openid"), ["https://www.googleapis.com/auth/cloud-platform"]);
});
