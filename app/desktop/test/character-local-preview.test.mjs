import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const charactersRoot = join(desktopRoot, "src", "renderer", "features", "characters");

const queriesSource = readFileSync(join(charactersRoot, "queries", "characters.queries.ts"), "utf8");
const studioSource = readFileSync(
  join(charactersRoot, "components", "CharacterReferenceStudio.tsx"),
  "utf8",
);

test("character previews route LOCAL_ONLY assets through the Electron media protocol", () => {
  assert.match(queriesSource, /localAssetPreviewUrl/);
  assert.match(queriesSource, /assetsApi\.get\s*\(/);
  assert.match(queriesSource, /storageMode\s*===\s*["']LOCAL_ONLY["']/);
  assert.match(queriesSource, /localAssetPreviewUrl\s*\(\s*projectId\s*,\s*assetId/);
});

test("CharacterReferenceStudio uses the storage-aware character asset preview hook", () => {
  assert.doesNotMatch(studioSource, /assetsApi\.downloadUrl\s*\(/);
  assert.match(studioSource, /useCharacterAssetPreview/);
});
