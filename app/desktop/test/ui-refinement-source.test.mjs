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
