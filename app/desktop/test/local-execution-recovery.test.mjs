import test from "node:test";
import assert from "node:assert/strict";
import { LocalExecutionService } from "../src/main/local-execution/service.ts";

const identity = {
  deviceId: "device-1",
  userId: "owner-1",
  deviceToken: "token-1",
};

const config = {
  backendBaseUrl: "http://localhost:8080",
  heartbeatIntervalMs: 20,
  capabilities: ["DESKTOP_APP", "PROJECT_RENDER"],
  projectRenderEnabled: true,
};

function identityStore() {
  return {
    load: async () => identity,
    save: async () => undefined,
    clear: async () => undefined,
  };
}

function emptyStorage() {
  return {
    resolveAsset: async () => {
      throw new Error("unexpected asset resolve");
    },
  };
}

function claimedRender() {
  return {
    jobId: "job-1",
    projectId: "project-1",
    storyVersionId: "story-1",
    resolution: "1080p",
    format: "mp4",
    aspectRatio: "16:9",
    totalDurationMs: 1_000,
    renderProfileJson: "{}",
    leaseToken: "lease-1",
    chapters: [],
    beats: [],
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function waitFor(predicate, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition was not reached before timeout");
}

test("initial transient heartbeat failure reconnects without another user action", async () => {
  let attempts = 0;
  const backend = {
    heartbeat: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary network failure");
    },
  };
  const service = new LocalExecutionService(
    config,
    identityStore(),
    backend,
    emptyStorage(),
  );

  await service.setUser("owner-1");
  await service.start();
  assert.equal(service.status().state, "OFFLINE");

  await waitFor(() => service.status().state === "ONLINE");
  assert.ok(attempts >= 2);
  service.stop();
});

test("logout while claim is pending cancels the returned claim before render work starts", async () => {
  const pendingClaim = deferred();
  let claimCalls = 0;
  let renderCalls = 0;
  let cancelCalls = 0;
  const backend = {
    heartbeat: async () => undefined,
    claimProjectRender: async () => {
      claimCalls += 1;
      if (claimCalls === 1) return null;
      return pendingClaim.promise;
    },
    heartbeatProjectRender: async () => undefined,
    reportProjectRenderProgress: async () => undefined,
    completeProjectRender: async () => undefined,
    cancelProjectRender: async () => {
      cancelCalls += 1;
    },
    failProjectRender: async () => undefined,
  };
  const renderer = {
    render: async () => {
      renderCalls += 1;
      return {
        renderFingerprint: "fp",
        localArtifactKey: "artifact",
        mimeType: "video/mp4",
        sizeBytes: 1,
        checksumSha256: "0".repeat(64),
        durationMs: 1_000,
        width: 1920,
        height: 1080,
        fps: 30,
      };
    },
  };
  const service = new LocalExecutionService(
    config,
    identityStore(),
    backend,
    emptyStorage(),
    renderer,
  );

  await service.setUser("owner-1");
  await service.start();
  await waitFor(() => claimCalls >= 1);

  const execution = service.executeNextProjectRender();
  await waitFor(() => claimCalls >= 2);
  await service.setUser(null);
  pendingClaim.resolve(claimedRender());

  const result = await execution;
  assert.equal(result, null);
  assert.equal(renderCalls, 0);
  assert.equal(cancelCalls, 1);
  service.stop();
});
