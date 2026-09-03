import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  compositionPolicyForBeat,
  sampleCompositionFrame,
} from "../src/shared/image-motion.ts";
import { renderProjectFrameWindows } from "../src/shared/render-frame-clock.ts";
import { renderWorkingDimensions } from "../src/main/rendering/segment-renderer.ts";
import { estimateRenderOutputBytes } from "../src/renderer/features/production/render-preflight.ts";

async function source(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

test("v3 project frame partition stays contiguous and covers narration", () => {
  for (const fps of [30, 60]) {
    const windows = renderProjectFrameWindows(
      [
        { startMs: 0, endMs: 4210 },
        { startMs: 4210, endMs: 8375 },
      ],
      8375,
      fps,
    );
    assert.equal(windows[0].endFrame, windows[1].startFrame);
    assert.equal(windows.at(-1).endFrame, Math.ceil((8375 * fps) / 1000));
    assert.equal(
      windows.reduce((total, window) => total + window.frameCount, 0),
      Math.ceil((8375 * fps) / 1000),
    );
  }
});

test("60 fps preflight reserves more render space than 30 fps", () => {
  const at30 = estimateRenderOutputBytes(600_000, "1080p", 30);
  const at60 = estimateRenderOutputBytes(600_000, "1080p", 60);
  assert.equal(at60, at30 * 2);
});

test("v3 moving still motion uses deterministic smoothstep samples", () => {
  const policy = compositionPolicyForBeat("IMAGE", "PAN");
  assert.equal(policy.framing, "COVER");
  assert.equal(policy.motionEasing, "SMOOTHSTEP");

  const start = sampleCompositionFrame(policy, 0, 61, 60);
  const middle = sampleCompositionFrame(policy, 30, 61, 60);
  const end = sampleCompositionFrame(policy, 60, 61, 60);
  assert.equal(start.zoom, 1.06);
  assert.equal(middle.zoom, 1.06);
  assert.equal(end.zoom, 1.06);
  assert.equal(start.centerX, 1);
  assert.equal(middle.centerX, 0.5);
  assert.equal(end.centerX, 0);
});

test("moving stills use bounded 2x working canvas while static images do not", () => {
  assert.deepEqual(renderWorkingDimensions(1920, 1080, false), { width: 1920, height: 1080 });
  assert.deepEqual(renderWorkingDimensions(1920, 1080, true), { width: 3840, height: 2160 });
  assert.deepEqual(renderWorkingDimensions(2560, 1440, true), { width: 5120, height: 2880 });
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

test("v3 segment renderer uses shared presets, exact frames and Lanczos supersampling", async () => {
  const renderer = await source("../src/main/rendering/segment-renderer.ts");
  assert.match(renderer, /imageMotionPreset/);
  assert.match(renderer, /-frames:v/);
  assert.match(renderer, /flags=lanczos/);
  assert.match(renderer, /zoompan/);
  assert.doesNotMatch(renderer, /renderFrameWindow/);
  assert.doesNotMatch(renderer, /Math\.round\(targetDurationSeconds \* manifest\.fps\)/);
});
