import test from "node:test";
import assert from "node:assert/strict";
import {
  claimContextIsCurrent,
  heartbeatRetryDelayMs,
} from "../src/main/local-execution/recovery-policy.ts";
import { LocalExecutionBackendClient } from "../src/main/local-execution/backend-client.ts";

test("claim response stays valid only for the current executor epoch and device", () => {
  const current = {
    claimEpoch: 4,
    currentEpoch: 4,
    claimedDeviceId: "device-1",
    currentDeviceId: "device-1",
    online: true,
  };

  assert.equal(claimContextIsCurrent(current), true);
  assert.equal(claimContextIsCurrent({ ...current, currentEpoch: 5 }), false);
  assert.equal(claimContextIsCurrent({ ...current, currentDeviceId: "device-2" }), false);
  assert.equal(claimContextIsCurrent({ ...current, currentDeviceId: null }), false);
  assert.equal(claimContextIsCurrent({ ...current, online: false }), false);
});

test("heartbeat retry uses bounded exponential backoff with jitter", () => {
  assert.equal(heartbeatRetryDelayMs(0, 1_000, 0), 800);
  assert.equal(heartbeatRetryDelayMs(0, 1_000, 1), 1_200);
  assert.equal(heartbeatRetryDelayMs(1, 1_000, 0.5), 2_000);
  assert.equal(heartbeatRetryDelayMs(100, 60_000, 1), 36_000);
});

test("recovery claim targets the requested backend render job", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(JSON.stringify({ success: true, data: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = new LocalExecutionBackendClient(
    {
      backendBaseUrl: "http://localhost:8080",
      heartbeatIntervalMs: 15_000,
      capabilities: ["PROJECT_RENDER"],
      projectRenderEnabled: true,
    },
    "test",
  );

  try {
    await client.claimProjectRender("device-token", "job-42");
    assert.equal(
      requestUrl,
      "http://localhost:8080/api/v1/local-devices/project-renders/claim?jobId=job-42",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
