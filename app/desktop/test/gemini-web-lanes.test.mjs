import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GEMINI_WEB_LANES, isGeminiWebLane } from "../src/shared/gemini-web-lanes.ts";

const preloadTypes = readFileSync("src/preload/types.ts", "utf8");
const sharedLanes = readFileSync("src/shared/gemini-web-lanes.ts", "utf8");
const preloadIndex = readFileSync("src/preload/index.ts", "utf8");
const ipc = readFileSync("src/main/gemini-web/gemini-web-ipc.ts", "utf8");
const character = readFileSync(
  "src/renderer/features/characters/services/character-reference-generation.ts",
  "utf8",
);
const storyboard = readFileSync(
  "src/renderer/features/storyboard/queries/storyboard-media.mutations.ts",
  "utf8",
);
const automation = readFileSync("src/main/gemini-web/gemini-web-automation.ts", "utf8");

test("generation input requires an explicit supported lane", () => {
  assert.match(sharedLanes, /CHARACTER.*STORYBOARD/);
  assert.match(preloadTypes, /interface GeminiWebGenerateImageInput[\s\S]*lane:\s*GeminiWebLane/);
  assert.match(ipc, /isGeminiWebLane\(input\.lane\)/);
  assert.doesNotMatch(ipc, /input\.lane\s*\?\?/);
});

test("lane guard accepts only Character and Storyboard", () => {
  assert.deepEqual(GEMINI_WEB_LANES, ["CHARACTER", "STORYBOARD"]);
  assert.equal(isGeminiWebLane("CHARACTER"), true);
  assert.equal(isGeminiWebLane("STORYBOARD"), true);
  assert.equal(isGeminiWebLane("character"), false);
  assert.equal(isGeminiWebLane(undefined), false);
});

test("Character and Storyboard send their own lane", () => {
  assert.match(character, /lane:\s*["']CHARACTER["']/);
  assert.match(storyboard, /lane:\s*["']STORYBOARD["']/);
});

test("selection staging retains the lane and commit validates it", () => {
  assert.match(ipc, /sourcePath,\s*lane/);
  assert.match(ipc, /stagedSelection\.lane\s*!==\s*input\.lane/);
});

test("preload exposes an explicit commit lane contract", () => {
  assert.match(preloadTypes, /commitImage\(input:\s*\{[\s\S]*lane:\s*GeminiWebLane/);
  assert.match(preloadIndex, /generateImage:\s*\(input:\s*GeminiWebGenerateImageInput\)/);
});

test("both lanes own independent activity and download state", () => {
  assert.match(automation, /private readonly lanes = new Map<GeminiWebLane/);
  assert.match(automation, /active:\s*boolean/);
  assert.match(automation, /join\(rootDirectory,\s*["']lanes["'],\s*lane\.toLowerCase\(\),\s*["']downloads["']\)/);
  assert.doesNotMatch(automation, /private active = false/);
  assert.doesNotMatch(automation, /private readonly downloadDirectory/);
});

test("lane target restoration never falls back to an arbitrary Gemini target", () => {
  assert.match(automation, /candidate\.id === targetId/);
  assert.match(automation, /laneState\.targetId = created\.id/);
  assert.match(automation, /if \(!created\.id \|\| !created\.webSocketDebuggerUrl\)/);
  assert.doesNotMatch(automation, /targets\.find\(\s*\(target\)\s*=>\s*target\.type === "page"/);
});

test("generation captures and downloads stay on the requested lane", () => {
  assert.match(automation, /downloadPath:\s*laneState\.downloadDirectory/);
  assert.match(automation, /snapshotDownloads\(laneState\.downloadDirectory\)/);
  assert.match(automation, /captureGeneratedImageFallback\([\s\S]*laneState\.downloadDirectory/);
});
