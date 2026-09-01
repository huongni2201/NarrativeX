import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultWindowBounds,
  resolveRestoredWindowState,
} from "../src/main/preferences/window-state.ts";

const primary = {
  id: 1,
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
};
const secondary = {
  id: 2,
  workArea: { x: 1920, y: 0, width: 2560, height: 1400 },
};

test("default window bounds fill the current work area while respecting minimums", () => {
  assert.deepEqual(defaultWindowBounds(primary), {
    x: 0,
    y: 0,
    width: 1920,
    height: 1040,
  });
});

test("valid saved bounds and maximized state are restored", () => {
  assert.deepEqual(
    resolveRestoredWindowState(
      { x: 2100, y: 80, width: 1500, height: 900, maximized: true },
      [primary, secondary],
      primary,
    ),
    {
      bounds: { x: 2100, y: 80, width: 1500, height: 900 },
      maximized: true,
    },
  );
});

test("off-screen saved bounds fall back to the current display", () => {
  assert.deepEqual(
    resolveRestoredWindowState(
      { x: 9000, y: 9000, width: 1400, height: 900, maximized: false },
      [primary],
      primary,
    ),
    {
      bounds: { x: 0, y: 0, width: 1920, height: 1040 },
      maximized: false,
    },
  );
});

test("undersized restored windows are clamped to the desktop minimum", () => {
  const restored = resolveRestoredWindowState(
    { x: 100, y: 100, width: 600, height: 400, maximized: false },
    [primary],
    primary,
  );
  assert.equal(restored.bounds.width, 1180);
  assert.equal(restored.bounds.height, 720);
});
