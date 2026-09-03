import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as motion from "../src/shared/image-motion.ts";
import * as frames from "../src/shared/render-frame-clock.ts";

async function source(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

test("composition v3 exposes deterministic shared motion sampling", () => {
  assert.equal(typeof motion.compositionPolicyForBeat, "function");
  assert.equal(typeof motion.sampleCompositionFrame, "function");
  assert.equal(typeof motion.cssTransformFromCompositionSample, "function");
});

test("project frame partition API is available for narration-master rendering", () => {
  assert.equal(typeof frames.renderProjectFrameWindows, "function");
  assert.equal(typeof frames.projectFrameAtTime, "function");
});

test("editor preview consumes the render controller plan instead of recomputing AUTO", async () => {
  const editor = await source("../src/renderer/features/editor/EditorScreen.tsx");
  assert.doesNotMatch(editor, /createBeatDecision\(selected,\s*["']AUTO["']\)/);
  assert.match(editor, /renderController\.autoEditPlan/);
  assert.match(editor, /renderController\.frameRate/);
});

test("preview framing is authoritative and not driven by the viewer fit dropdown", async () => {
  const viewport = await source("../src/renderer/features/editor/components/EditorPreviewViewport.tsx");
  assert.match(viewport, /mediaType\s*===\s*["']IMAGE["']\s*\?\s*["']cover["']\s*:\s*["']contain["']/);
  assert.doesNotMatch(viewport, /fitMode\s*===\s*["']Fill["']\s*\?\s*["']cover["']/);
});

test("segment renderer uses exact frame output and high quality downscale", async () => {
  const renderer = await source("../src/main/rendering/segment-renderer.ts");
  assert.match(renderer, /-frames:v/);
  assert.match(renderer, /flags=lanczos/);
  assert.match(renderer, /project-image-motion-v3-composition/);
});
