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
  assert.match(source, /Tiếp tục khôi phục/);
  assert.match(source, /Mở Editor để thử lại/);

  // Displays recovery metadata
  assert.match(source, /unfinished\.jobId/);
  assert.match(source, /unfinished\.stage/);
  assert.match(source, /unfinished\.recoveryAction/);
  assert.match(source, /unfinished\.recoverabilityReason/);
});

test("recovery IPC validates the local journal and reclaims the requested backend job", () => {
  const source = readFileSync(join(desktopRoot, "src", "main", "bootstrap-core.ts"), "utf8");
  const execution = readFileSync(join(desktopRoot, "src", "main", "local-execution", "service.ts"), "utf8");
  assert.match(source, /renderJournals\.load\(projectId, jobId\)/);
  assert.match(source, /journal\.renderFingerprint/);
  assert.match(source, /resumeProjectRender\(projectId, jobId\)/);
  assert.match(execution, /claimProjectRender\(\s*identity\.deviceToken,\s*recoveryTarget\?\.jobId,?\s*\)/);
  assert.match(execution, /claimed\.projectId !== recoveryTarget\.projectId/);
  assert.doesNotMatch(source, /desktop:render:resume-recovery[\s\S]{0,400}return true/);
});

test("render resume validates runtime versions and reconciles registered artifact checksums", () => {
  const source = readFileSync(
    join(desktopRoot, "src", "main", "rendering", "project-renderer.ts"),
    "utf8",
  );
  assert.match(source, /journal\.renderFingerprint !== manifest\.renderFingerprint/);
  assert.match(source, /journal\.rendererVersion !== this\.rendererVersion/);
  assert.match(source, /journal\.ffmpegVersion !== this\.runtime\.version/);
  assert.match(source, /journal\.finalChecksum !== finalChecksum/);
});

test("discard persists local terminal state before backend lease synchronization", () => {
  const source = readFileSync(join(desktopRoot, "src", "main", "bootstrap-core.ts"), "utf8");
  const discard = source.slice(
    source.indexOf('registerTrustedIpcHandler("desktop:render:discard-recovery"'),
    source.indexOf('registerTrustedIpcHandler("desktop:render:resume-recovery"'),
  );
  assert.ok(discard.indexOf("await renderJournals.discard") < discard.indexOf("discardProjectRenderRecovery"));
});

test("DesktopApp mounts RenderRecoveryDialog alongside routes and providers", () => {
  const appSource = readFileSync(join(rendererRoot, "app", "DesktopApp.tsx"), "utf8");

  assert.match(appSource, /<RenderRecoveryDialog \/>/);
});
