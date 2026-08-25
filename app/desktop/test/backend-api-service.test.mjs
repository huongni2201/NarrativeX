import test from "node:test";
import assert from "node:assert/strict";
import { DesktopBackendApiService } from "../src/main/api/backend-api-service.ts";

const deviceId = "00000000-0000-4000-8000-000000000001";
const secret = "s".repeat(43);

test("guest bootstrap replaces renderer body with main-process installation credentials", async () => {
  const calls = [];
  const browserSession = {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return {
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ success: true }),
      };
    },
  };
  const guestIdentity = {
    loadOrCreate: async () => ({ deviceId, secret }),
  };
  const service = new DesktopBackendApiService(
    "http://localhost:8080",
    browserSession,
    guestIdentity,
  );

  await service.request({
    path: "/api/v1/auth/desktop/guest",
    method: "POST",
    headers: { "X-XSRF-TOKEN": "csrf" },
    body: JSON.stringify({ deviceId: "renderer-controlled", secret: "renderer-controlled" }),
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), { deviceId, secret });
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers.get("Content-Type"), "application/json");
});

test("non-guest API requests are not rewritten", async () => {
  const calls = [];
  const browserSession = {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { status: 204, statusText: "No Content", text: async () => "" };
    },
  };
  const guestIdentity = {
    loadOrCreate: async () => {
      throw new Error("must not load guest identity");
    },
  };
  const service = new DesktopBackendApiService(
    "http://localhost:8080",
    browserSession,
    guestIdentity,
  );

  await service.request({ path: "/api/v1/projects", method: "POST", body: "project-body" });

  assert.equal(calls[0].init.body, "project-body");
});
