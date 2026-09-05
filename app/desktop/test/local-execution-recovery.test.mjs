import test from "node:test";
import assert from "node:assert/strict";
import {
  claimSessionIsCurrent,
  heartbeatRetryDelayMs,
} from "../src/main/local-execution/recovery-policy.ts";

test("claim response becomes invalid after logout or account/session generation change", () => {
  const current = {
    claimEpoch: 4,
    currentEpoch: 4,
    claimedDeviceId: "device-1",
    currentDeviceId: "device-1",
    claimedUserId: "owner-1",
    currentUserId: "owner-1",
    online: true,
  };

  assert.equal(claimSessionIsCurrent(current), true);
  assert.equal(claimSessionIsCurrent({ ...current, currentEpoch: 5 }), false);
  assert.equal(claimSessionIsCurrent({ ...current, currentUserId: null }), false);
  assert.equal(claimSessionIsCurrent({ ...current, currentUserId: "owner-2" }), false);
  assert.equal(claimSessionIsCurrent({ ...current, currentDeviceId: null }), false);
  assert.equal(claimSessionIsCurrent({ ...current, online: false }), false);
});

test("heartbeat retry uses bounded exponential backoff with jitter", () => {
  assert.equal(heartbeatRetryDelayMs(0, 1_000, 0), 800);
  assert.equal(heartbeatRetryDelayMs(0, 1_000, 1), 1_200);
  assert.equal(heartbeatRetryDelayMs(1, 1_000, 0.5), 2_000);
  assert.equal(heartbeatRetryDelayMs(100, 60_000, 1), 36_000);
});
