import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");

test("RenderRecoveryDialog provides interrupted render discovery and recovery actions", () => {
  const source = readFileSync(
    join(rendererRoot, "features", "production", "components", "RenderRecoveryDialog.tsx"),
    "utf8"
  );

  // Queries recoveryStatus on startup
  assert.match(source, /recoveryStatus\(\)/);

  // Provides discard/cancel and resume actions
  assert.match(source, /handleDiscard/);
  assert.match(source, /handleResume/);
  assert.match(source, /Huỷ bỏ tác vụ cũ/);
  assert.match(source, /Mở dự án để xử lý/);

  // Displays recovery metadata
  assert.match(source, /unfinished\.jobId/);
  assert.match(source, /unfinished\.stage/);
  assert.match(source, /unfinished\.recoveryAction/);
});

test("DesktopApp mounts RenderRecoveryDialog alongside routes and providers", () => {
  const appSource = readFileSync(join(rendererRoot, "app", "DesktopApp.tsx"), "utf8");

  assert.match(appSource, /<RenderRecoveryDialog \/>/);
});
