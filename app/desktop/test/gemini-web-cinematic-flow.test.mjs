import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { findGeminiModelCandidateIndex } from "../src/main/gemini-web/gemini-web-model-selection.ts";

const automationSource = readFileSync(
  new URL("../src/main/gemini-web/gemini-web-automation.ts", import.meta.url),
  "utf8",
);

test("Gemini 3.1 Pro target accepts the current Pro-only picker label", () => {
  assert.equal(
    findGeminiModelCandidateIndex(
      [
        {
          role: "button",
          label: "Pro",
          ariaLabel: "",
          title: "",
        },
      ],
      "Gemini 3.1 Pro",
    ),
    0,
  );
});

test("Gemini generation enters image mode, selects cinematic preset, then selects Pro model", () => {
  assert.match(automationSource, /GEMINI_IMAGE_PRESET\s*=\s*"Điện ảnh"/);

  const imageModeIndex = automationSource.indexOf("await this.activateImagesMode(cdp)");
  const presetIndex = automationSource.indexOf("await this.selectImagePreset(cdp, GEMINI_IMAGE_PRESET)");
  const modelIndex = automationSource.indexOf("await this.selectModel(cdp, GEMINI_IMAGE_MODEL)");

  assert.ok(imageModeIndex >= 0, "image mode must be activated");
  assert.ok(presetIndex > imageModeIndex, "cinematic preset must be selected after image mode is ready");
  assert.ok(modelIndex > presetIndex, "Pro model must be selected after preset");
});

test("Gemini image discovery supports the current single-image output DOM", () => {
  assert.match(automationSource, /single-image/);
  assert.match(automationSource, /baseline\.imageSources/);
});

test("Gemini first-load UI controls are polled instead of checked only once", () => {
  assert.match(automationSource, /GEMINI_UI_READY_TIMEOUT_MS/);
  assert.match(automationSource, /while \(Date\.now\(\) < deadline\)/);
});
