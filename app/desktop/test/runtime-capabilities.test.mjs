import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { isStrategySupported, DEFAULT_FALLBACK_CAPABILITY } from "../src/renderer/features/runtime/model/runtime-capabilities.ts";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");

function readSource(relPath) {
  return readFileSync(join(rendererRoot, relPath), "utf8");
}

test("isStrategySupported verifies against capability strategies", () => {
  assert.equal(isStrategySupported("TEXT_TO_VIDEO", DEFAULT_FALLBACK_CAPABILITY), true);
  assert.equal(isStrategySupported("IMAGE_TO_VIDEO", DEFAULT_FALLBACK_CAPABILITY), false);
  assert.equal(isStrategySupported("FIRST_LAST_FRAME", DEFAULT_FALLBACK_CAPABILITY), false);

  const extendedCapability = {
    ...DEFAULT_FALLBACK_CAPABILITY,
    strategies: ["TEXT_TO_VIDEO", "IMAGE_TO_VIDEO"],
  };
  assert.equal(isStrategySupported("IMAGE_TO_VIDEO", extendedCapability), true);
  assert.equal(isStrategySupported("FIRST_LAST_FRAME", extendedCapability), false);
});

test("ShotActionToolbar restricts strategies according to runtime capability", () => {
  const toolbarSource = readSource("features/storyboard/components/ShotActionToolbar.tsx");

  assert.match(
    toolbarSource,
    /supportedStrategies\?: GenerationStrategy\[\];/,
    "ShotActionToolbar must accept supportedStrategies prop",
  );
  assert.match(
    toolbarSource,
    /<SelectItem value="TEXT_TO_VIDEO" disabled=\{!isT2VSupported\}>/,
    "Text to Video must be conditional on isT2VSupported",
  );
  assert.match(
    toolbarSource,
    /<SelectItem value="IMAGE_TO_VIDEO" disabled=\{!isI2VSupported\}>/,
    "Image to Video must be disabled when unsupported",
  );
  assert.match(
    toolbarSource,
    /<SelectItem value="FIRST_LAST_FRAME" disabled=\{!isFLFSupported\}>/,
    "First/Last Frame must be disabled when unsupported",
  );
});

test("VideoShotboard wires runtime capabilities and handles worker availability", () => {
  const shotboardSource = readSource("features/storyboard/components/VideoShotboard.tsx");

  assert.match(
    shotboardSource,
    /useRuntimeCapabilities\(\)/,
    "VideoShotboard must call useRuntimeCapabilities",
  );
  assert.match(
    shotboardSource,
    /supportedStrategies=\{supportedStrategies\}/,
    "VideoShotboard must pass supportedStrategies to ShotActionToolbar",
  );
  assert.match(
    shotboardSource,
    /!isAvailable/,
    "VideoShotboard must block actions when runtime is unavailable",
  );
});
