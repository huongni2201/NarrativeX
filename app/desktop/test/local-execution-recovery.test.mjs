import test from "node:test";
import assert from "node:assert/strict";
import {
  claimContextIsCurrent,
  heartbeatRetryDelayMs,
} from "../src/main/local-execution/recovery-policy.ts";

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
