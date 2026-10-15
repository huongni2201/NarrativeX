import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const rendererRoot = join(resolve(dirname(import.meta.filename), ".."), "src", "renderer", "features");
const read = (path) => readFileSync(join(rendererRoot, path), "utf8");

test("Editor Inspector owns subtitle styling in its own tab", () => {
  const inspector = read("editor/components/EditorInspectorPanel.tsx");
  assert.match(inspector, /type InspectorTab = "scene" \| "audio" \| "effects" \| "subtitle"/);
  assert.match(inspector, /<SubtitleSettingsPanel controller=\{subtitleController\} variant="inspector" \/>/);
  // Project-wide settings: selecting another beat must not bounce the user out of the tab.
  assert.match(inspector, /tab === "subtitle" \? tab : "scene"/);
});

test("Render dialog no longer embeds the subtitle editor, only a summary and a jump to the Inspector", () => {
  const dialog = read("production/components/RenderDialog.tsx");
  assert.doesNotMatch(dialog, /<SubtitleSettingsPanel/);
  assert.match(dialog, /onEditSubtitles/);
  assert.match(dialog, /subtitleSaveStatus\(controller/);
});

test("Editor preview renders the draft style immediately, with a sample caption while the tab is open", () => {
  const viewport = read("editor/components/EditorPreviewViewport.tsx");
  const screen = read("editor/EditorScreen.tsx");
  assert.match(viewport, /resolvePreviewSubtitleText\(/);
  assert.match(viewport, /<SubtitleOverlay text=\{subtitleText\} style=\{subtitleStyle\}/);
  // The same controller feeds the Inspector inputs and the preview, so edits show before saving.
  assert.match(screen, /subtitleStyle=\{renderController\.subtitleStyle\}/);
  assert.match(screen, /subtitleController=\{renderController\}/);
  assert.match(screen, /subtitleEditing=\{subtitleEditing\}/);
});

test("Inspector variant of the subtitle panel is single column and leaves preview to the video frame", () => {
  const panel = read("production/components/SubtitleSettingsPanel.tsx");
  assert.match(panel, /variant\?: "full" \| "inspector"/);
  assert.match(panel, /compact \? "grid gap-4" : "grid gap-4 sm:grid-cols-2"/);
  assert.match(panel, /\{compact \? \(\s*<p[^>]*>Xem trước trực tiếp/);
});
