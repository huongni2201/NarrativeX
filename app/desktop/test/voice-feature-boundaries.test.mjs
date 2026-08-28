import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const voiceRoot = join(desktopRoot, "src", "renderer", "features", "voices");

test("VoiceScreen delegates transport cache and native media workflows", () => {
  const source = readFileSync(join(voiceRoot, "screens", "VoiceScreen.tsx"), "utf8");

  assert.doesNotMatch(source, /import\s+\{[^}]*\buseQuery(?:Client)?\b[^}]*\}\s+from\s+["']@tanstack\/react-query["']/s);
  assert.doesNotMatch(source, /import\s+\{\s*assetsApi\s*\}/);
  assert.doesNotMatch(source, /import\s+\{\s*narrationApi\s*\}/);
  assert.doesNotMatch(source, /window\.narrativex\.localStorage\.(?:selectAsset|commitSelectedAsset)\s*\(/);
  assert.doesNotMatch(source, /window\.narrativex\.api\.uploadVoiceReference\s*\(/);
  assert.match(source, /useVoiceReferenceAsset/);
  assert.match(source, /useVoicePreviewResult/);
  assert.match(source, /useImportVoiceAudioAsset/);
  assert.match(source, /useUploadVoiceReference/);
});

test("Voice pure helpers live under model", () => {
  const screenSource = readFileSync(join(voiceRoot, "screens", "VoiceScreen.tsx"), "utf8");
  const filterSource = readFileSync(join(voiceRoot, "components", "VoiceFiltersBar.tsx"), "utf8");

  assert.match(screenSource, /\.\.\/model\/voice-filters/);
  assert.match(filterSource, /\.\.\/model\/voice-filters/);
});
