import assert from "node:assert/strict";
import test from "node:test";
import { shouldDisableHardwareAcceleration } from "../src/main/runtime/gpu-policy.ts";

test("hardware acceleration remains enabled by default", () => {
  assert.equal(shouldDisableHardwareAcceleration({}, []), false);
});

test("safe mode explicitly disables hardware acceleration", () => {
  assert.equal(shouldDisableHardwareAcceleration({}, ["--safe-mode"]), true);
  assert.equal(shouldDisableHardwareAcceleration({}, ["--disable-gpu"]), true);
  assert.equal(
    shouldDisableHardwareAcceleration({ NARRATIVEX_DISABLE_GPU: "true" }, []),
    true,
  );
});
