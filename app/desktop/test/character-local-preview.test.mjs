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
const screenSource = readFileSync(
  join(charactersRoot, "screens", "CharactersScreen.tsx"),
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

test("character cards resolve portraits from their own pinned character version", () => {
  const cardSource = screenSource.slice(
    screenSource.indexOf("function CharacterCard"),
    screenSource.indexOf("function DetailRow"),
  );

  assert.match(
    cardSource,
    /useCharacterPortrait\(\s*projectId\s*,\s*character\.id\s*,\s*character\.pinnedCharacterVersionId\s*\?\?\s*null\s*\)/,
  );
  assert.doesNotMatch(
    screenSource,
    /portraitUrl=\{character\.id\s*===\s*selectedId\s*\?\s*portraitQuery\.url\s*:\s*null\}/,
  );
});
