import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");
const featuresRoot = join(rendererRoot, "features");
const legacyApiFiles = [
  "assets.api.ts",
  "catalog.api.ts",
  "chapters.api.ts",
  "generation.api.ts",
  "narration.api.ts",
  "production.api.ts",
  "projects.api.ts",
  "workspace.ts",
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

test("domain APIs live inside owning features", () => {
  for (const file of legacyApiFiles) {
    assert.equal(
      existsSync(join(rendererRoot, "api", file)),
      false,
      `legacy renderer/api/${file} must not exist`,
    );
  }
});

test("features only use renderer/api for shared transport primitives", () => {
  const forbidden = /(?:\.\.\/){2,}api\/(?:assets\.api|catalog\.api|chapters\.api|generation\.api|narration\.api|production\.api|projects\.api|workspace)/;
  const violations = [];
  for (const file of sourceFiles(featuresRoot)) {
    const source = readFileSync(file, "utf8");
    if (forbidden.test(source)) violations.push(file.replace(`${desktopRoot}/`, ""));
  }
  assert.deepEqual(violations, []);
});

test("StoryboardScreen delegates Gemini queue persistence and transitions to feature modules", () => {
  const screenPath = join(
    featuresRoot,
    "storyboard",
    "screens",
    "StoryboardScreen.tsx",
  );
  const source = readFileSync(screenPath, "utf8");

  assert.doesNotMatch(source, /\blocalStorage\.(?:getItem|setItem|removeItem)\s*\(/);
  assert.doesNotMatch(source, /function geminiQueueStorageKey\s*\(/);
  assert.doesNotMatch(source, /function uniqueIds\s*\(/);
  assert.match(source, /loadGeminiQueue/);
  assert.match(source, /saveGeminiQueue/);
  assert.match(source, /reconcileQueue/);
  assert.match(source, /markQueueBeatCompleted/);
  assert.match(source, /markQueueBeatSkipped/);
});
