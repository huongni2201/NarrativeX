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

test("character previews resolve directly through the project-local media protocol", () => {
  assert.match(queriesSource, /localAssetPreviewUrl\s*\(\s*projectId\s*,\s*assetId/);
  assert.doesNotMatch(queriesSource, /assetsApi\.get\s*\(/);
  assert.doesNotMatch(queriesSource, /assetsApi\.downloadUrl\s*\(/);
  assert.doesNotMatch(queriesSource, /storageMode|LOCAL_ONLY|REMOTE|HYBRID|PROJECT_LOCAL/);
});

test("CharacterReferenceStudio uses the project-local character asset preview hook", () => {
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
