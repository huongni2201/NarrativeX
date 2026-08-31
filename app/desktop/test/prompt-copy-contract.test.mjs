import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");

test("storyboard prompt copy uses the protected Desktop clipboard bridge", () => {
  const screen = readFileSync(
    resolve(desktopRoot, "src/renderer/features/storyboard/screens/StoryboardScreen.tsx"),
    "utf8",
  );
  const preload = readFileSync(resolve(desktopRoot, "src/preload/index.ts"), "utf8");
  const main = readFileSync(resolve(desktopRoot, "src/main/main.ts"), "utf8");

  assert.match(screen, /window\.narrativex\.system\.copyText\(beat\.prompt\)/);
  assert.doesNotMatch(screen, /compileGeminiPrompt/);
  assert.doesNotMatch(screen, /IMAGE TASK:/);
  assert.doesNotMatch(screen, /navigator\.clipboard/);
  assert.match(preload, /desktop:system:clipboard-write/);
  assert.match(
    main,
    /registerTrustedIpcHandler\("desktop:system:clipboard-write", trustPolicy, async \(text\) =>/,
  );
  assert.match(main, /await clipboard\.writeText\(text\);/);
});
