import test from "node:test";
import assert from "node:assert/strict";
import { LocalRenderPreflightService } from "../src/main/rendering/local-render-preflight.ts";

const runtime = { available: true, ffmpegPath: "ffmpeg", ffprobePath: "ffprobe", version: "test", reason: null };
const storage = {
  projectDirectory: () => ".",
  resolveAsset: async () => ".",
};

test("preflight only passes for an online, paired, user-bound executor", async () => {
  const service = new LocalRenderPreflightService(runtime, storage);
  const states = ["OFFLINE", "UNPAIRED", "CONNECTING", "ONLINE"];
  for (const state of states) {
    const result = await service.check(
      { projectId: "project", assetIds: [], estimatedOutputBytes: 0, requiredTemporaryBytes: 0 },
      { state, currentUserValid: true, devicePaired: true },
    );
    assert.equal(result.ready, state === "ONLINE");
    if (state !== "ONLINE") assert.ok(result.blockers.some((code) => code.startsWith("EXECUTOR_")));
  }
});

test("preflight returns stable identity blockers instead of parsing messages", async () => {
  const service = new LocalRenderPreflightService(runtime, storage);
  const result = await service.check(
    { projectId: "project", assetIds: [], estimatedOutputBytes: 0, requiredTemporaryBytes: 0 },
    { state: "ONLINE", currentUserValid: false, devicePaired: false },
  );
  assert.deepEqual(result.blockers, ["USER_MISMATCH", "DEVICE_MISMATCH"]);
});
