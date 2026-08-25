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

test("login sends only the PKCE challenge and exchange keeps the verifier in main", async () => {
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
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(startUrl.searchParams.has("code_verifier"), false);

  const result = await service.exchange("a".repeat(43));
  assert.equal(result.status, 200);
  const exchangeRequest = backend.requests[1];
  const payload = JSON.parse(exchangeRequest.body);
  assert.equal(payload.code, "a".repeat(43));
  assert.match(payload.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(createDesktopAuthChallenge(payload.codeVerifier), challenge);
  await assert.rejects(() => service.exchange("a".repeat(43)), /No pending desktop login/);
});

test("a new login replaces the pending verifier and failed opening clears it", async () => {
  const backend = fakeBackendApi();
  backend.responses.push(csrfResponse, exchangeResponse());
  const openedUrls = [];
  const service = new DesktopAuthService(
    "http://localhost:8080",
    backend,
    async (url) => openedUrls.push(url),
  );

  await service.login();
  const firstChallenge = new URL(openedUrls[0]).searchParams.get("code_challenge");
  await service.login();
  const secondChallenge = new URL(openedUrls[1]).searchParams.get("code_challenge");
  assert.notEqual(firstChallenge, secondChallenge);
  await service.exchange("b".repeat(43));
  const verifier = JSON.parse(backend.requests[1].body).codeVerifier;
  assert.equal(createDesktopAuthChallenge(verifier), secondChallenge);

  const failed = new DesktopAuthService(
    "http://localhost:8080",
    backend,
    async () => {
      throw new Error("browser unavailable");
    },
  );
  await assert.rejects(() => failed.login(), /browser unavailable/);
  await assert.rejects(() => failed.exchange("c".repeat(43)), /No pending desktop login/);
  assert.match(createDesktopAuthVerifier(), /^[A-Za-z0-9_-]{43}$/);
});

test("logout clears a pending verifier before making the logout request", async () => {
  const backend = fakeBackendApi();
  backend.responses.push(csrfResponse, { status: 204, statusText: "No Content", bodyText: "" });
  const service = new DesktopAuthService(
    "http://localhost:8080",
    backend,
    async () => undefined,
  );

  await service.login();
  await service.logout();
  await assert.rejects(() => service.exchange("d".repeat(43)), /No pending desktop login/);
  assert.equal(backend.requests[1].path, "/logout");
});
