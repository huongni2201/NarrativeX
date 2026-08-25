import test from "node:test";
import assert from "node:assert/strict";
import { invokeWindowControl } from "../src/renderer/app/window-control-actions.ts";

test("window control actions invoke each preload method once", async () => {
  const calls = [];
  const controls = {
    minimize: async () => calls.push("minimize"),
    toggleMaximize: async () => {
      calls.push("toggleMaximize");
      return true;
    },
    close: async () => calls.push("close"),
  };

  await invokeWindowControl(controls, "minimize");
  const maximized = await invokeWindowControl(controls, "toggleMaximize");
  await invokeWindowControl(controls, "close");

  assert.equal(maximized, true);
  assert.deepEqual(calls, ["minimize", "toggleMaximize", "close"]);
});

test("window control actions reject when the bridge is unavailable", async () => {
  await assert.rejects(
    () => invokeWindowControl(undefined, "close"),
    /Native window controls are unavailable/,
  );
});
