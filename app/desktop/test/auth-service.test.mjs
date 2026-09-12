import test from "node:test";
import assert from "node:assert/strict";
import {
  createDesktopAuthChallenge,
  createDesktopAuthVerifier,
  DesktopAuthService,
} from "../src/main/auth/auth-service.ts";

const csrfResponse = {
  status: 200,
  statusText: "OK",
  bodyText: JSON.stringify({
    success: true,
    data: { token: "csrf-token", headerName: "X-XSRF-TOKEN" },
  }),
};

function exchangeResponse() {
  return {
    status: 200,
    statusText: "OK",
    bodyText: JSON.stringify({
      success: true,
      data: { id: "user-1", displayName: "User", email: null, avatarUrl: null },
    }),
  };
}

function fakeBackendApi() {
  const requests = [];
  const responses = [];
  return {
    requests,
    responses,
    request: async (input) => {
      requests.push(input);
      const response = responses.shift();
      if (!response) throw new Error("Unexpected backend request.");
      return response;
    },
  };
}

function callbackToken(code, attemptId) {
  return `${code}.${attemptId}`;
}

test("login sends attempt and PKCE challenge while exchange keeps the verifier in main", async () => {
  const backend = fakeBackendApi();
  backend.responses.push(csrfResponse, exchangeResponse());
  const openedUrls = [];
  const service = new DesktopAuthService(
    "http://localhost:8080",
    backend,
    async (url) => openedUrls.push(url),
  );

  await service.login();
  const startUrl = new URL(openedUrls[0]);
  const challenge = startUrl.searchParams.get("code_challenge");
  const attemptId = startUrl.searchParams.get("attempt");
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.match(attemptId, /^[0-9a-f-]{36}$/i);
  assert.equal(startUrl.searchParams.has("code_verifier"), false);

  const result = await service.exchange(callbackToken("a".repeat(43), attemptId));
  assert.equal(result.status, 200);
  const exchangeRequest = backend.requests[1];
  const payload = JSON.parse(exchangeRequest.body);
  assert.equal(payload.code, "a".repeat(43));
  assert.match(payload.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(createDesktopAuthChallenge(payload.codeVerifier), challenge);
  await assert.rejects(
    () => service.exchange(callbackToken("a".repeat(43), attemptId)),
    /No pending desktop login/,
  );
});

test("overlapping logins keep independent verifiers when callbacks arrive in reverse order", async () => {
  const backend = fakeBackendApi();
  backend.responses.push(csrfResponse, exchangeResponse(), csrfResponse, exchangeResponse());
  const openedUrls = [];
  const service = new DesktopAuthService(
    "http://localhost:8080",
    backend,
    async (url) => openedUrls.push(url),
  );

  await service.login();
  await service.login();
  const first = new URL(openedUrls[0]);
  const second = new URL(openedUrls[1]);
  const firstAttempt = first.searchParams.get("attempt");
  const secondAttempt = second.searchParams.get("attempt");
  const firstChallenge = first.searchParams.get("code_challenge");
  const secondChallenge = second.searchParams.get("code_challenge");
  assert.notEqual(firstAttempt, secondAttempt);
  assert.notEqual(firstChallenge, secondChallenge);

  await service.exchange(callbackToken("b".repeat(43), firstAttempt));
  await service.exchange(callbackToken("c".repeat(43), secondAttempt));

  const firstVerifier = JSON.parse(backend.requests[1].body).codeVerifier;
  const secondVerifier = JSON.parse(backend.requests[3].body).codeVerifier;
  assert.equal(createDesktopAuthChallenge(firstVerifier), firstChallenge);
  assert.equal(createDesktopAuthChallenge(secondVerifier), secondChallenge);
});

test("failed browser opening clears only its own pending attempt", async () => {
  const backend = fakeBackendApi();
  const failed = new DesktopAuthService(
    "http://localhost:8080",
    backend,
    async () => {
      throw new Error("browser unavailable");
    },
  );
  await assert.rejects(() => failed.login(), /browser unavailable/);
  await assert.rejects(
    () => failed.exchange(callbackToken("c".repeat(43), "00000000-0000-4000-8000-000000000001")),
    /No pending desktop login/,
  );
  assert.match(createDesktopAuthVerifier(), /^[A-Za-z0-9_-]{43}$/);
});

test("logout clears all pending verifiers before making the logout request", async () => {
  const backend = fakeBackendApi();
  backend.responses.push(csrfResponse, { status: 204, statusText: "No Content", bodyText: "" });
  const openedUrls = [];
  const service = new DesktopAuthService(
    "http://localhost:8080",
    backend,
    async (url) => openedUrls.push(url),
  );

  await service.login();
  const attemptId = new URL(openedUrls[0]).searchParams.get("attempt");
  await service.logout();
  await assert.rejects(
    () => service.exchange(callbackToken("d".repeat(43), attemptId)),
    /No pending desktop login/,
  );
  assert.equal(backend.requests[1].path, "/logout");
});
