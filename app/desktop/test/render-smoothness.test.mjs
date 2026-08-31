import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cssImageTransform } from "../src/shared/image-motion.ts";
import { renderFrameWindow } from "../src/shared/render-frame-clock.ts";
import { estimateRenderOutputBytes } from "../src/renderer/features/production/render-preflight.ts";

async function source(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

test("global frame windows stay contiguous at 30 and 60 fps", () => {
  for (const fps of [30, 60]) {
    const first = renderFrameWindow(0, 4210, fps);
    const second = renderFrameWindow(4210, 8375, fps);
    assert.equal(first.endFrame, second.startFrame);
    assert.equal(first.durationSeconds, first.frameCount / fps);
    assert.equal(second.durationSeconds, second.frameCount / fps);
  }
});

test("60 fps preflight reserves more render space than 30 fps", () => {
  const at30 = estimateRenderOutputBytes(600_000, "1080p", 30);
  const at60 = estimateRenderOutputBytes(600_000, "1080p", 60);
  assert.equal(at60, at30 * 2);
});

test("shared motion preserves preview pan endpoints", () => {
  assert.equal(cssImageTransform("PAN", 0), "translate(-3.000%, 0.000%) scale(1.0600)");
  assert.equal(cssImageTransform("PAN", 1), "translate(3.000%, 0.000%) scale(1.0600)");
});

test("preview fallback uses requestAnimationFrame without transform chase", async () => {
  const surface = await source("../src/renderer/features/editor/components/EditorPlaybackSurface.tsx");
  const viewport = await source("../src/renderer/features/editor/components/EditorPreviewViewport.tsx");
  assert.match(surface, /requestAnimationFrame/);
  assert.doesNotMatch(surface, /setInterval/);
  assert.doesNotMatch(viewport, /transform 90ms linear/);
});

test("render UI and API expose selected frame rate", async () => {
  const dialog = await source("../src/renderer/features/production/components/RenderDialog.tsx");
  const api = await source("../src/renderer/features/production/api/production.api.ts");
  assert.match(dialog, /30 FPS/);
  assert.match(dialog, /60 FPS/);
  assert.match(api, /fps: frameRate/);
});

test("final segment renderer uses shared motion and global frame clock", async () => {
  const renderer = await source("../src/main/rendering/segment-renderer.ts");
  assert.match(renderer, /imageMotionPreset/);
  assert.match(renderer, /renderFrameWindow/);
  assert.doesNotMatch(renderer, /Math\.round\(targetDurationSeconds \* manifest\.fps\)/);
});
