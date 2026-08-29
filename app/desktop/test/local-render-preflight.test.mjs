import test from "node:test";
import assert from "node:assert/strict";
import { LocalRenderPreflightService } from "../src/main/rendering/local-render-preflight.ts";

const runtime = { available: true, ffmpegPath: "ffmpeg", ffprobePath: "ffprobe", version: "test", reason: null };

function storageWithResolver(resolveAsset) {
  return {
    projectDirectory: () => ".",
    resolveAsset,
  };
}

const storage = storageWithResolver(async () => ".");
const onlineContext = { state: "ONLINE", currentUserValid: true, devicePaired: true };

function input(assets = []) {
  return {
    projectId: "project",
    assets,
    estimatedOutputBytes: 0,
    requiredTemporaryBytes: 0,
  };
}

test("preflight only passes for an online, paired, user-bound executor", async () => {
  const service = new LocalRenderPreflightService(runtime, storage);
  const states = ["OFFLINE", "UNPAIRED", "CONNECTING", "ONLINE"];
  for (const state of states) {
    const result = await service.check(input(), {
      state,
      currentUserValid: true,
      devicePaired: true,
    });
    assert.equal(result.ready, state === "ONLINE");
    if (state !== "ONLINE") assert.ok(result.blockers.some((code) => code.startsWith("EXECUTOR_")));
  }
});

test("preflight returns stable identity blockers instead of parsing messages", async () => {
  const service = new LocalRenderPreflightService(runtime, storage);
  const result = await service.check(input(), {
    state: "ONLINE",
    currentUserValid: false,
    devicePaired: false,
  });
  assert.deepEqual(result.blockers, ["USER_MISMATCH", "DEVICE_MISMATCH"]);
});

test("every missing project render asset blocks render", async () => {
  const missingStorage = storageWithResolver(async () => {
    throw new Error("Asset is missing or not registered.");
  });
  const service = new LocalRenderPreflightService(runtime, missingStorage);

  const result = await service.check(
    input([{ assetId: "audio-1" }, { assetId: "image-1" }]),
    onlineContext,
  );

  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("ASSET_MISSING"));
  assert.deepEqual(
    result.assets.map(({ assetId, state }) => ({ assetId, state })),
    [
      { assetId: "audio-1", state: "MISSING" },
      { assetId: "image-1", state: "MISSING" },
    ],
  );
});

test("available project assets pass local integrity preflight", async () => {
  const service = new LocalRenderPreflightService(runtime, storage);
  const result = await service.check(
    input([{ assetId: "local-image" }, { assetId: "local-audio" }]),
    onlineContext,
  );

  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(
    result.assets.map(({ assetId, state }) => ({ assetId, state })),
    [
      { assetId: "local-image", state: "AVAILABLE" },
      { assetId: "local-audio", state: "AVAILABLE" },
    ],
  );
});
