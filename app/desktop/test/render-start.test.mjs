import test from "node:test";
import assert from "node:assert/strict";
import { startRenderWithDestination } from "../src/renderer/features/production/render-start.ts";

test("canceling destination selection never queues a render", async () => {
  let queued = 0;
  const result = await startRenderWithDestination({
    chooseDestination: async () => null,
    preflight: async () => ({ ready: true }),
    queue: async () => {
      queued += 1;
      return { jobId: "job-1" };
    },
  });

  assert.equal(result, null);
  assert.equal(queued, 0);
});

test("selected destination is retained with queued job", async () => {
  const result = await startRenderWithDestination({
    chooseDestination: async () => ({ token: "token-1", directory: "/exports" }),
    preflight: async () => ({ ready: true }),
    queue: async () => ({ jobId: "job-1" }),
  });

  assert.deepEqual(result, {
    destination: { token: "token-1", directory: "/exports" },
    job: { jobId: "job-1" },
  });
});
