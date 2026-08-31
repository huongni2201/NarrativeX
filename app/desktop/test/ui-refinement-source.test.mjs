import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const rendererDir = resolve(testDir, "../src/renderer");

function source(path) {
  return readFileSync(resolve(rendererDir, path), "utf8");
}

test("workspace navigation uses semantic selected styling without decorative glow", () => {
  const shell = source("features/workspace/components/WorkspaceShell.tsx");

  assert.doesNotMatch(shell, /bg-\[#1e1710\]/);
  assert.doesNotMatch(shell, /shadow-\[0_0_12px_rgba\(255,138,0,0\.15\)\]/);
  assert.match(shell, /bg-primary-muted/);
});

test("workspace navigation keeps production destinations contextual", () => {
  const shell = source("features/workspace/components/WorkspaceShell.tsx");

  assert.doesNotMatch(shell, /\{ id: "images", label: "Media"/);
  assert.doesNotMatch(shell, /\{ id: "render", label: "Render"/);
  assert.match(shell, /label: "Assets"/);
  assert.match(shell, /label: "Settings"/);
});

test("shared controls encode NarrativeX desktop density", () => {
  const button = source("components/ui/button.tsx");
  const input = source("components/ui/input.tsx");
  const textarea = source("components/ui/textarea.tsx");

  assert.match(button, /text-\[12px\]/);
  assert.match(button, /h-8/);
  assert.match(input, /h-8/);
  assert.match(input, /text-\[12px\]/);
  assert.match(textarea, /text-\[12px\]/);
});

test("editor workstation avoids decorative hard-coded selected glows", () => {
  const explorer = source("features/editor/components/EditorExplorerPanel.tsx");
  const timeline = source("features/editor/components/EditorMultiTrackTimeline.tsx");

  assert.doesNotMatch(explorer, /bg-\[#131926\]/);
  assert.doesNotMatch(explorer, /shadow-\[0_0_14px_rgba\(255,138,0,0\.12\)\]/);
  assert.doesNotMatch(timeline, /bg-\[#090d15\]/);
  assert.doesNotMatch(timeline, /shadow-\[0_0_8px_rgba\(255,138,0,0\.6\)\]/);
});

test("dense workstation primitives are shared instead of screen-local shells", () => {
  const primitives = source("features/workspace/components/WorkstationPrimitives.tsx");

  assert.match(primitives, /export function WorkspacePane/);
  assert.match(primitives, /export function WorkspaceToolbar/);
  assert.match(primitives, /export function PropertyRow/);
  assert.match(primitives, /export function InlineNotice/);
});

test("storyboard no longer reserves separate chapter and scene rails", () => {
  const storyboard = source("features/storyboard/screens/StoryboardScreen.tsx");

  assert.doesNotMatch(storyboard, /grid-cols-\[130px_320px_minmax\(0,1fr\)\]/);
  assert.match(storyboard, /StoryboardNavigator/);
});

test("visual beat cards use an adaptive media-first grid", () => {
  const beats = source("features/storyboard/components/VisualBeatGrid.tsx");

  assert.match(beats, /repeat\(auto-fill,minmax/);
  assert.match(beats, /aspect-video/);
  assert.doesNotMatch(beats, />Gemini Web</);
  assert.doesNotMatch(beats, />Generate New</);
});

test("chapters use adjacent workstation panes without outer card gaps", () => {
  const chapters = source("features/chapters/screens/ChaptersScreen.tsx");

  assert.doesNotMatch(chapters, /gap-3 overflow-hidden p-4/);
});

test("chapter writing surface is a pane rather than a floating dashboard card", () => {
  const editor = source("features/chapters/components/ChapterEditorPanel.tsx");

  assert.doesNotMatch(editor, /shadow-\[var\(--shadow-panel\)\]/);
  assert.doesNotMatch(editor, /rounded-lg border border-border bg-surface-panel/);
});

test("asset browser renders project-local image previews", () => {
  const assets = source("features/assets/screens/AssetsScreen.tsx");

  assert.match(assets, /localAssetPreviewUrl/);
  assert.match(assets, /asset\.type === "IMAGE"/);
  assert.match(assets, /<img/);
});

test("settings groups runtime diagnostics and project defaults", () => {
  const settings = source("features/settings/screens/SettingsScreen.tsx");

  assert.match(settings, /Runtime & Storage/);
  assert.match(settings, /Project Defaults/);
  assert.doesNotMatch(settings, /max-w-3xl divide-y/);
});
