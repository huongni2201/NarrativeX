import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");

test("video shotboard and story inspector prompt copy uses the protected Desktop clipboard bridge", () => {
  const shotboard = readFileSync(
    resolve(desktopRoot, "src/renderer/features/storyboard/components/VideoShotboard.tsx"),
    "utf8",
  );
  const preload = readFileSync(resolve(desktopRoot, "src/preload/index.ts"), "utf8");
  const bootstrap = readFileSync(resolve(desktopRoot, "src/main/bootstrap-core.ts"), "utf8");

  assert.match(shotboard, /onCopyPrompt/);
  assert.doesNotMatch(shotboard, /IMAGE TASK:/);
  assert.doesNotMatch(shotboard, /navigator\.clipboard/);
  assert.match(preload, /desktop:system:clipboard-write/);
  assert.match(
    bootstrap,
    /registerTrustedIpcHandler\("desktop:system:clipboard-write", trustPolicy, async \(text\) =>/,
  );
  assert.match(bootstrap, /await clipboard\.writeText\(text\);/);
});

test("story beat inspector prompt copy uses the protected Desktop clipboard bridge", () => {
  const inspector = readFileSync(
    resolve(desktopRoot, "src/renderer/features/story/components/StoryBeatInspector.tsx"),
    "utf8",
  );

  assert.match(inspector, /window\.narrativex\.system\.copyText\(beat\.visualBeats\[0\]\.prompt\)/);
  assert.doesNotMatch(inspector, /IMAGE TASK:/);
  assert.doesNotMatch(inspector, /navigator\.clipboard/);
});
