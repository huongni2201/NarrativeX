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

test("SSE streams use the Electron session and parse chunked event frames", async () => {
  const calls = [];
  const encoder = new TextEncoder();
  const chunks = [
    "event: snap",
    "shot\r\nid: running-25\r\ndata: {\"status\":\"RUN",
    "NING\"}\r\ndata: second-line\r\nretry: 1500\r\n\r\n: keep-alive\r\n\r\n",
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  const browserSession = {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream;charset=UTF-8" },
      });
    },
  };
  const service = new DesktopBackendApiService(
    "http://localhost:8080",
    browserSession,
    { loadOrCreate: async () => ({ deviceId, secret }) },
  );
  const events = [];

  await service.streamEvents(
    "/api/v1/generation-jobs/00000000-0000-4000-8000-000000000002/events",
    (event) => events.push(event),
    new AbortController().signal,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers.Accept, "text/event-stream");
  assert.deepEqual(events, [
    {
      event: "snapshot",
      data: '{"status":"RUNNING"}\nsecond-line',
      id: "running-25",
      retry: 1500,
    },
  ]);
});
